/**
 * Background Service Worker
 * Manages side panel behavior with domain-based state
 * All tabs on the same domain share the panel open/close state
 */

// Import Notion service
importScripts('notion-service.js');

class SidePanelManager {
  constructor() {
    this.enabledDomains = new Set();
    this.storageKey = 'enabledDomains';
    this.panelOpenTabId = null; // Track which tab has the panel open
    this.panelOpenDomain = null; // Track which domain the open panel is for
    this.init();
  }

  async init() {
    try {
      // Enable automatic opening - it will only open on tabs where panel is enabled
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      
      // Load saved domain states
      await this.loadDomainStates();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Initialize panel state on install
      chrome.runtime.onInstalled.addListener(() => this.handleInstall());
      
      // Setup context menu
      this.setupContextMenu();
      
      console.log('SidePanelManager initialized');
    } catch (error) {
      console.error('Error initializing side panel:', error);
    }
  }

  setupEventListeners() {
    // Handle new tabs - check if domain has panel enabled
    chrome.tabs.onCreated.addListener((tab) => this.handleTabCreated(tab));
    
    // Handle tab removed - clear panel tracking if it's the open tab
    chrome.tabs.onRemoved.addListener((tabId) => {
      if (this.panelOpenTabId === tabId) {
        this.panelOpenTabId = null;
        this.panelOpenDomain = null;
      }
    });
    
    // Handle tab activation - apply domain state
    chrome.tabs.onActivated.addListener((activeInfo) => this.handleTabActivated(activeInfo));
    
    // Handle tab updates (navigation) - apply domain state
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.handleTabUpdated(tab);
        // If panel is open on a different domain, close it
        if (this.panelOpenDomain && tab.id === this.panelOpenTabId) {
          const domain = this.extractDomain(tab.url);
          if (domain !== this.panelOpenDomain) {
            console.log('URL changed in panel tab from', this.panelOpenDomain, 'to', domain, '- closing panel');
            this.closePanelForTab(tab.id, tab.windowId);
            this.panelOpenTabId = null;
            this.panelOpenDomain = null;
          }
        }
      }
    });
    
    // Handle icon click - this fires BEFORE Chrome tries to open the panel
    // We use this to enable the panel for new domains
    if (chrome.action && chrome.action.onClicked) {
      chrome.action.onClicked.addListener(async (tab) => {
        console.log('Extension icon clicked, tab:', tab);
        await this.handleActionClick(tab);
      });
      console.log('Action click listener registered');
    } else {
      console.error('chrome.action.onClicked is not available');
    }

    // Handle context menu clicks
    if (chrome.contextMenus) {
      chrome.contextMenus.onClicked.addListener((info, tab) => this.handleContextMenuClick(info, tab));
    }

    // Handle messages from content script (e.g. opening panel from notification)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Handle save_note_to_notion - runs in background so it survives panel closing
      if (message.action === 'save_note_to_notion') {
        (async () => {
          try {
            console.log('Background: Saving note to Notion:', message.url);
            await notionService.init();
            
            const savedNote = await notionService.saveNote(message.url, message.content, message.pageTitle);
            
            // Update cache with ID from API response
            await notionService.cacheNote(message.url, {
              id: savedNote?.id,
              title: message.pageTitle || message.url,
              url: message.url,
              content: message.content,
              lastSaved: Date.now() // Add timestamp
            });
            
            console.log('Background: Note saved successfully:', message.url);
            sendResponse({ 
              success: true, 
              note: savedNote,
              lastSaved: Date.now()
            });
          } catch (error) {
            console.error('Background: Error saving note:', error);
            sendResponse({ 
              success: false, 
              error: error.message 
            });
          }
        })();
        return true; // Keep channel open for async response
      }

      // Handle check_note_exists from content script
      if (message.action === 'check_note_exists') {
        (async () => {
          try {
            await notionService.init();
            if (!notionService.isAuthenticated()) {
              sendResponse({ noteExists: false });
              return;
            }
            
            const note = await notionService.getNoteByUrl(message.url);
            sendResponse({ noteExists: !!note });
          } catch (error) {
            console.error('Error checking note:', error);
            sendResponse({ noteExists: false });
          }
        })();
        return true; // Keep channel open for async response
      }
      
      // Handle open_side_panel
      if (message.action === 'open_side_panel' && sender.tab) {
        const tabId = sender.tab.id;
        const windowId = sender.tab.windowId;
        
        // Enable the panel for this tab first
        chrome.sidePanel.setOptions({
          tabId: tabId,
          path: 'sidepanel.html',
          enabled: true
        }).then(() => {
          // Now open it while still in the gesture context
          return chrome.sidePanel.open({ tabId: tabId, windowId: windowId });
        }).then(() => {
          console.log('Panel opened successfully');
          sendResponse({ success: true });
        }).catch((error) => {
          console.error('Error opening panel:', error);
          sendResponse({ success: false, error: error.message });
        });
        
        return true; // Keep the channel open for async response
      }
    });
  }

  setupContextMenu() {
    // Create the context menu item
    // We use chrome.runtime.onInstalled in handleInstall, but we can also ensure it exists here
    chrome.contextMenus.create({
      id: "add-to-note",
      title: "Add selection to note",
      contexts: ["selection"]
    }, () => {
      // Ignore error if item already exists
      if (chrome.runtime.lastError) {
        // Menu item might already exist
      }
    });
  }

  async handleInstall() {
    try {
      // Disable panel globally on install
      await chrome.sidePanel.setOptions({ enabled: false });
      
      // Re-create context menu on install/update to ensure it's there
      chrome.contextMenus.removeAll(() => {
        this.setupContextMenu();
      });
    } catch (error) {
      console.error('Error during installation:', error);
    }
  }

  async handleContextMenuClick(info, tab) {
    if (info.menuItemId === "add-to-note" && info.selectionText && tab.url) {
      try {
        // Initialize Notion service
        await notionService.init();
        
        if (!notionService.isAuthenticated()) {
          console.log('User not authenticated with Notion');
          return;
        }
        
        const url = tab.url;
        const textToAdd = `<p>${info.selectionText}</p>`;
        
        // Get existing note or create new one
        let note = await notionService.getNoteByUrl(url);
        let currentContent = '';
        
        if (note) {
          // Get existing content
          currentContent = await notionService.getPageContent(note.id);
        }
        
        const newContent = currentContent + textToAdd;
        
        // Save back to Notion
        await notionService.saveNote(url, newContent, tab.title);
      } catch (error) {
        console.error('Error adding to note from context menu:', error);
      }
    }
  }

  async handleOpenPanelRequest(tab) {
    try {
      console.log('handleOpenPanelRequest called with:', tab);
      const tabId = tab.id || tab.tabId;
      const windowId = tab.windowId;
      
      console.log('Attempting to open panel for tabId:', tabId, 'windowId:', windowId);
      
      // Enable panel for this tab specifically so it can be opened
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        path: 'sidepanel.html',
        enabled: true
      });
      
      console.log('Panel options set, now opening panel');
      
      // Open the panel
      await chrome.sidePanel.open({ tabId: tabId, windowId: windowId });
      console.log('Panel opened successfully');
    } catch (error) {
      console.error('Error opening panel from request:', error);
      throw error;
    }
  }

  async loadDomainStates() {
    try {
      // Try sync storage first, fall back to local for migration
      let data = await chrome.storage.sync.get(this.storageKey);
      if (!data[this.storageKey]) {
        // Check local storage for migration
        const localData = await chrome.storage.local.get(this.storageKey);
        if (localData[this.storageKey]) {
          // Migrate from local to sync
          await chrome.storage.sync.set({ [this.storageKey]: localData[this.storageKey] });
          data = localData;
        }
      }
      const domains = data[this.storageKey] || [];
      this.enabledDomains = new Set(domains);
      
      // Apply states to all existing tabs
      await this.applyDomainStatesToAllTabs();
    } catch (error) {
      console.error('Error loading domain states:', error);
    }
  }

  async saveDomainStates() {
    try {
      // Use sync storage for persistence across extension disable/enable
      await chrome.storage.sync.set({
        [this.storageKey]: Array.from(this.enabledDomains)
      });
    } catch (error) {
      console.error('Error saving domain states:', error);
      // If sync storage quota exceeded, fall back to local storage
      if (error.message && error.message.includes('QUOTA_BYTES')) {
        try {
          await chrome.storage.local.set({
            [this.storageKey]: Array.from(this.enabledDomains)
          });
        } catch (localError) {
          console.error('Error saving to local storage:', localError);
        }
      }
    }
  }

  extractDomain(url) {
    try {
      if (!url || url.startsWith('chrome://') || url.startsWith('brave://') || 
          url.startsWith('edge://') || url.startsWith('about:') || 
          url.startsWith('chrome-extension://')) {
        return null;
      }
      
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch (error) {
      return null;
    }
  }

  async applyPanelStateToTab(tabId, domain, enabled) {
    try {
      if (enabled) {
        await chrome.sidePanel.setOptions({
          tabId: tabId,
          path: 'sidepanel.html',
          enabled: true
        });
      } else {
        await chrome.sidePanel.setOptions({
          tabId: tabId,
          enabled: false
        });
      }
    } catch (error) {
      // Tab might not exist or be invalid, ignore
      console.debug('Error applying panel state to tab:', tabId, error);
    }
  }

  async applyDomainStateToAllTabs(domain, enabled) {
    try {
      const tabs = await chrome.tabs.query({});
      
      for (const tab of tabs) {
        if (tab.url) {
          const tabDomain = this.extractDomain(tab.url);
          if (tabDomain === domain) {
            await this.applyPanelStateToTab(tab.id, domain, enabled);
          }
        }
      }
    } catch (error) {
      console.error('Error applying domain state to all tabs:', error);
    }
  }

  async applyDomainStatesToAllTabs() {
    try {
      const tabs = await chrome.tabs.query({});
      
      for (const tab of tabs) {
        if (tab.url) {
          const domain = this.extractDomain(tab.url);
          if (domain) {
            const enabled = this.enabledDomains.has(domain);
            await this.applyPanelStateToTab(tab.id, domain, enabled);
          } else {
            // Disable for special URLs
            await this.applyPanelStateToTab(tab.id, null, false);
          }
        }
      }
    } catch (error) {
      console.error('Error applying domain states to all tabs:', error);
    }
  }

  async handleTabCreated(tab) {
    if (!tab.url) return;
    
    const domain = this.extractDomain(tab.url);
    
    // If a new tab is created on a different domain, close the panel
    if (this.panelOpenDomain && domain !== this.panelOpenDomain) {
      console.log('New tab created on different domain:', domain, '- closing panel from domain:', this.panelOpenDomain);
      if (this.panelOpenTabId) {
        await this.closePanelForTab(this.panelOpenTabId, tab.windowId);
      }
      this.panelOpenTabId = null;
      this.panelOpenDomain = null;
    }
    
    if (domain) {
      const enabled = this.enabledDomains.has(domain);
      await this.applyPanelStateToTab(tab.id, domain, enabled);
    } else {
      // Disable for special URLs
      await this.applyPanelStateToTab(tab.id, null, false);
    }
  }

  async handleTabActivated(activeInfo) {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (tab.url) {
        const domain = this.extractDomain(tab.url);
        
        // If panel is open on a different domain, close it
        if (this.panelOpenDomain && domain !== this.panelOpenDomain) {
          console.log('Domain changed from', this.panelOpenDomain, 'to', domain, '- closing panel');
          await this.closePanelForTab(this.panelOpenTabId, tab.windowId);
          this.panelOpenTabId = null;
          this.panelOpenDomain = null;
        }
        
        await this.handleTabUpdated(tab);
        
        // Ensure panel is ready if domain is enabled
        if (domain && this.enabledDomains.has(domain)) {
          await this.ensurePanelReadyForTab(tab);
        } else if (!domain) {
          // Special URL (chrome://, about:, etc), close the panel
          if (this.panelOpenTabId && this.panelOpenTabId !== tab.id) {
            await this.closePanelForTab(this.panelOpenTabId, tab.windowId);
            this.panelOpenTabId = null;
            this.panelOpenDomain = null;
          }
        }
      }
    } catch (error) {
      console.error('Error handling tab activation:', error);
    }
  }
  
  // Ensure panel is ready for a tab (enabled if domain is enabled)
  async ensurePanelReadyForTab(tab) {
    if (!tab || !tab.url) return;
    
    const domain = this.extractDomain(tab.url);
    if (domain && this.enabledDomains.has(domain)) {
      // Panel should already be enabled via handleTabUpdated, but ensure it
      try {
        await chrome.sidePanel.setOptions({
          tabId: tab.id,
          path: 'sidepanel.html',
          enabled: true
        });
      } catch (error) {
        // Ignore errors
      }
    }
  }

  async handleTabUpdated(tab) {
    if (!tab.url) return;
    
    const domain = this.extractDomain(tab.url);
    if (domain) {
      const enabled = this.enabledDomains.has(domain);
      // CRITICAL: Always ensure panel state is correct for this tab
      // This ensures the panel is ready when the user clicks the icon
      // With openPanelOnActionClick: true, Chrome will open it automatically if enabled
      await this.applyPanelStateToTab(tab.id, domain, enabled);
    } else {
      // Disable for special URLs
      await this.applyPanelStateToTab(tab.id, null, false);
    }
  }
  
  // Helper to close panel for a specific tab
  async closePanelForTab(tabId, windowId) {
    try {
      console.log('Attempting to close panel for tab:', tabId);
      // Try the close method first (available in newer Chrome versions)
      if (chrome.sidePanel && chrome.sidePanel.close) {
        await chrome.sidePanel.close({ tabId: tabId, windowId: windowId });
        console.log('Panel closed successfully');
      } else {
        // Fallback: disable the panel for this tab
        console.log('sidePanel.close not available, disabling panel instead');
        await chrome.sidePanel.setOptions({
          tabId: tabId,
          enabled: false
        });
      }
    } catch (error) {
      // Try disabling as fallback if close fails
      try {
        console.log('Close failed, trying to disable panel:', error.message);
        await chrome.sidePanel.setOptions({
          tabId: tabId,
          enabled: false
        });
      } catch (disableError) {
        console.debug('Could not disable panel for tab:', tabId, disableError.message);
      }
    }
  }

  // Helper to enable panel for a tab immediately (for new domains)
  async enablePanelForTabImmediately(tabId) {
    try {
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        path: 'sidepanel.html',
        enabled: true
      });
    } catch (error) {
      console.error('Error enabling panel immediately:', error);
    }
  }

  async handleActionClick(tab) {
    try {
      // Get the active tab if not provided
      if (!tab || !tab.id) {
        try {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab) {
            tab = activeTab;
          } else {
            return;
          }
        } catch (error) {
          console.error('Error getting active tab:', error);
          return;
        }
      }

      const domain = this.extractDomain(tab.url);
      if (!domain) {
        // Can't enable for special URLs
        return;
      }

      const isEnabled = this.enabledDomains.has(domain);

      if (!isEnabled) {
        // FIRST CLICK: Enable panel for this domain
        // This implements the "2-click" pattern from the old version
        this.enabledDomains.add(domain);
        await this.saveDomainStates();
        
        // Enable panel for the current tab
        await chrome.sidePanel.setOptions({
          tabId: tab.id,
          path: 'sidepanel.html',
          enabled: true
        });
        
        // Enable for all other tabs with this domain
        await this.applyDomainStateToAllTabs(domain, true);
        
        // Track that panel is now open for this domain
        this.panelOpenTabId = tab.id;
        this.panelOpenDomain = domain;
        
        // Now manually open the panel (since this is the "enable" click)
        // The next click will use Chrome's auto-open
        try {
          await chrome.sidePanel.open({ tabId: tab.id });
        } catch (error) {
          // Might fail if Chrome is already trying to open it, that's OK
        }
      } else {
        // Domain is already enabled - track that panel was opened
        this.panelOpenTabId = tab.id;
        this.panelOpenDomain = domain;
      }
    } catch (error) {
      console.error('Error in handleActionClick:', error);
    }
  }
}

// Initialize the side panel manager
new SidePanelManager();
