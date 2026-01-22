/**
 * Background Service Worker
 * Manages side panel behavior with domain-based state
 * All tabs on the same domain share the panel open/close state
 */

class SidePanelManager {
  constructor() {
    this.enabledDomains = new Set();
    this.storageKey = 'enabledDomains';
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
      
      console.log('SidePanelManager initialized');
    } catch (error) {
      console.error('Error initializing side panel:', error);
    }
  }

  setupEventListeners() {
    // Handle new tabs - check if domain has panel enabled
    chrome.tabs.onCreated.addListener((tab) => this.handleTabCreated(tab));
    
    // Handle tab activation - apply domain state
    chrome.tabs.onActivated.addListener((activeInfo) => this.handleTabActivated(activeInfo));
    
    // Handle tab updates (navigation) - apply domain state
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.handleTabUpdated(tab);
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
  }

  async handleInstall() {
    try {
      // Disable panel globally on install
      await chrome.sidePanel.setOptions({ enabled: false });
    } catch (error) {
      console.error('Error during installation:', error);
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
        await this.handleTabUpdated(tab);
        // Also ensure panel is ready for immediate opening
        await this.ensurePanelReadyForTab(tab);
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
        
        // Now manually open the panel (since this is the "enable" click)
        // The next click will use Chrome's auto-open
        try {
          await chrome.sidePanel.open({ tabId: tab.id });
        } catch (error) {
          // Might fail if Chrome is already trying to open it, that's OK
        }
      }
      // If domain is already enabled, Chrome will handle open/close automatically
      // due to openPanelOnActionClick: true
    } catch (error) {
      console.error('Error in handleActionClick:', error);
    }
  }
}

// Initialize the side panel manager
new SidePanelManager();
