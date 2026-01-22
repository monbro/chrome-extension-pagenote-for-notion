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
      // Configure side panel to open on icon click
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      
      // Load saved domain states
      await this.loadDomainStates();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Initialize panel state on install
      chrome.runtime.onInstalled.addListener(() => this.handleInstall());
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
    
    // Handle icon click to toggle panel for domain
    chrome.action.onClicked.addListener((tab) => this.handleActionClick(tab));
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
      const data = await chrome.storage.local.get(this.storageKey);
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
      await chrome.storage.local.set({
        [this.storageKey]: Array.from(this.enabledDomains)
      });
    } catch (error) {
      console.error('Error saving domain states:', error);
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
      }
    } catch (error) {
      console.error('Error handling tab activation:', error);
    }
  }

  async handleTabUpdated(tab) {
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

  async handleActionClick(tab) {
    try {
      const domain = this.extractDomain(tab.url);
      
      if (!domain) {
        // Can't enable for special URLs
        return;
      }

      const isEnabled = this.enabledDomains.has(domain);

      if (!isEnabled) {
        // Enable panel for this domain
        this.enabledDomains.add(domain);
        await this.saveDomainStates();
        await this.applyDomainStateToAllTabs(domain, true);
        // Panel will open automatically due to openPanelOnActionClick
      } else {
        // Disable panel for this domain
        this.enabledDomains.delete(domain);
        await this.saveDomainStates();
        await this.applyDomainStateToAllTabs(domain, false);
      }
    } catch (error) {
      console.error('Error handling action click:', error);
    }
  }
}

// Initialize the side panel manager
new SidePanelManager();
