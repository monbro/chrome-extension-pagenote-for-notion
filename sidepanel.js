/**
 * Sticky Notes Side Panel - Main Application Logic
 * Manages note editing, saving, and formatting for URL-specific notes
 */

class NoteEditor {
  constructor() {
    this.currentUrl = '';
    this.saveTimeout = null;
    this.debounceDelay = 500; // ms
    
    this.elements = {
      editor: document.getElementById('note-editor'),
      urlLabel: document.getElementById('url-label'),
      domainLabel: document.getElementById('domain-label'),
      statusMsg: document.getElementById('status'),
      infoBtn: document.getElementById('close-btn')
    };

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadCurrentTabNote();
    this.setupPlaceholder();
  }

  setupPlaceholder() {
    const placeholder = this.elements.editor.getAttribute('data-placeholder');
    if (placeholder) {
      this.elements.editor.setAttribute('data-placeholder', placeholder);
    }
  }

  setupEventListeners() {
    // Formatting buttons
    const formatButtons = {
      'btn-bold': 'bold',
      'btn-italic': 'italic',
      'btn-underline': 'underline',
      'btn-list': 'insertUnorderedList',
      'btn-indent': 'indent',
      'btn-outdent': 'outdent'
    };

    Object.entries(formatButtons).forEach(([id, command]) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => this.formatText(command));
      }
    });

    // Editor input with debouncing
    this.elements.editor.addEventListener('input', () => this.handleInput());
    
    // Tab change listeners - update note when switching tabs or navigating
    chrome.tabs.onActivated?.addListener(() => this.loadCurrentTabNote());
    chrome.tabs.onUpdated?.addListener((tabId, changeInfo, tab) => {
      // Update when URL changes or when page finishes loading
      if (changeInfo.url || (changeInfo.status === 'complete' && tab.url)) {
        this.loadCurrentTabNote();
      }
    });

    // Info button
    if (this.elements.infoBtn) {
      this.elements.infoBtn.addEventListener('click', () => this.showInfo());
    }
  }

  formatText(command) {
    try {
      document.execCommand(command, false, null);
      this.elements.editor.focus();
    } catch (error) {
      console.error('Error formatting text:', error);
    }
  }

  handleInput() {
    if (!this.currentUrl) return;

    // Clear existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Debounce save operation
    this.saveTimeout = setTimeout(() => {
      this.saveNote();
    }, this.debounceDelay);
  }

  async saveNote() {
    if (!this.currentUrl) return;

    try {
      const content = this.elements.editor.innerHTML;
      await chrome.storage.local.set({ [this.currentUrl]: content });
      this.showStatus('Gespeichert');
    } catch (error) {
      console.error('Error saving note:', error);
      this.showStatus('Fehler beim Speichern', true);
    }
  }

  showStatus(message, isError = false) {
    this.elements.statusMsg.textContent = message;
    this.elements.statusMsg.classList.toggle('error', isError);
    this.elements.statusMsg.classList.add('visible');
    
    setTimeout(() => {
      this.elements.statusMsg.classList.remove('visible');
      if (isError) {
        this.elements.statusMsg.classList.remove('error');
      }
    }, 2000);
  }

  async loadNote(url) {
    // Skip chrome:// and other special URLs
    if (!url || url.startsWith('chrome://') || url.startsWith('brave://') || 
        url.startsWith('edge://') || url.startsWith('about:')) {
      this.elements.editor.innerHTML = '';
      this.elements.urlLabel.textContent = 'Nicht verfügbar für diese Seite';
      this.elements.domainLabel.textContent = 'Notizen';
      this.currentUrl = '';
      return;
    }

    try {
      this.currentUrl = url;
      this.updateUrlDisplay(url);
      
      const data = await chrome.storage.local.get(url);
      this.elements.editor.innerHTML = data[url] || '';
    } catch (error) {
      console.error('Error loading note:', error);
      this.showStatus('Fehler beim Laden', true);
    }
  }

  updateUrlDisplay(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      this.elements.domainLabel.textContent = `Notizen für ${domain}`;
      this.elements.urlLabel.textContent = url;
    } catch (error) {
      // Fallback if URL parsing fails
      this.elements.domainLabel.textContent = 'Notizen';
      this.elements.urlLabel.textContent = url;
    }
  }

  async loadCurrentTabNote() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.url) {
        await this.loadNote(tabs[0].url);
      }
    } catch (error) {
      console.error('Error loading current tab:', error);
      this.elements.urlLabel.textContent = 'Fehler beim Laden';
    }
  }

  showInfo() {
    const message = `URL Context Notes v1.5\n\n` +
      `Speichern Sie Notizen für jede URL.\n` +
      `Notizen werden automatisch gespeichert.\n\n` +
      `Formatierung: Verwenden Sie die Toolbar-Buttons für Textformatierung.`;
    
    alert(message);
  }
}

// Initialize the editor when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new NoteEditor();
  });
} else {
  new NoteEditor();
}
