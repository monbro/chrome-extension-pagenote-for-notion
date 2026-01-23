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
      infoBtn: document.getElementById('close-btn'),
      exportBtn: document.getElementById('export-btn'),
      importBtn: document.getElementById('import-btn')
    };

    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.migrateFromLocalStorage();
    this.loadCurrentTabNote();
    this.setupPlaceholder();
    this.injectDashboardButton();
  }

  async migrateFromLocalStorage() {
    try {
      // Migrate all notes from local to sync storage
      const localData = await chrome.storage.local.get(null);
      const notesToMigrate = {};
      const noteKeys = ['enabledDomains']; // Keys to exclude
      
      Object.keys(localData).forEach(key => {
        if (!noteKeys.includes(key) && key.startsWith('http')) {
          notesToMigrate[key] = localData[key];
        }
      });
      
      if (Object.keys(notesToMigrate).length > 0) {
        // Check if already in sync storage
        const syncData = await chrome.storage.sync.get(Object.keys(notesToMigrate));
        const newNotes = {};
        
        Object.keys(notesToMigrate).forEach(key => {
          if (!syncData[key]) {
            newNotes[key] = notesToMigrate[key];
          }
        });
        
        if (Object.keys(newNotes).length > 0) {
          await chrome.storage.sync.set(newNotes);
          console.log(`Migrated ${Object.keys(newNotes).length} notes to sync storage`);
        }
      }
    } catch (error) {
      console.error('Error migrating from local storage:', error);
    }
  }

  setupPlaceholder() {
    const placeholder = this.elements.editor.getAttribute('data-placeholder');
    if (placeholder) {
      this.elements.editor.setAttribute('data-placeholder', placeholder);
    }
  }

  injectDashboardButton() {
    // Find the toolbar by looking for one of the existing buttons
    const exportBtn = this.elements.exportBtn;
    if (exportBtn && exportBtn.parentNode) {
      const dashboardBtn = document.createElement('button');
      dashboardBtn.id = 'dashboard-btn';
      dashboardBtn.innerHTML = '📊'; // Chart icon
      dashboardBtn.title = 'Open Notes Dashboard';
      dashboardBtn.style.marginRight = '2px';
      
      dashboardBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
      
      // Insert before the export button
      exportBtn.parentNode.insertBefore(dashboardBtn, exportBtn);
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

    // Export button
    if (this.elements.exportBtn) {
      this.elements.exportBtn.addEventListener('click', () => this.exportNotes());
    }

    // Import button
    if (this.elements.importBtn) {
      this.elements.importBtn.addEventListener('click', () => this.handleImportClick());
    }

    // Keyboard shortcuts
    this.elements.editor.addEventListener('keydown', (e) => this.handleKeyDown(e));

    // Listen for storage changes (e.g. from Context Menu additions)
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (this.currentUrl && changes[this.currentUrl]) {
        const newValue = changes[this.currentUrl].newValue;
        // Only update if the content is actually different to avoid cursor jumping
        if (newValue !== this.elements.editor.innerHTML) {
          this.elements.editor.innerHTML = newValue || '';
        }
      }
    });
  }

  formatText(command) {
    try {
      document.execCommand(command, false, null);
      this.elements.editor.focus();
    } catch (error) {
      console.error('Error formatting text:', error);
    }
  }

  handleKeyDown(e) {
    // Cmd+Shift+8 (Mac) or Ctrl+Shift+8 (Windows/Linux)
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;
    
    if (modifier && e.shiftKey && e.key === '8') {
      e.preventDefault();
      this.toggleListItem();
    }
  }

  toggleListItem() {
    try {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;

      const range = selection.getRangeAt(0);
      const editor = this.elements.editor;
      
      // Find the current block element (p, div, li, etc.)
      let currentNode = range.commonAncestorContainer;
      
      // Walk up to find a block element
      while (currentNode && currentNode !== editor) {
        if (currentNode.nodeType === Node.ELEMENT_NODE) {
          const tagName = currentNode.tagName.toLowerCase();
          if (['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            break;
          }
        }
        currentNode = currentNode.parentNode;
      }

      // Check if we're in a list item
      const isListItem = currentNode && currentNode.tagName && currentNode.tagName.toLowerCase() === 'li';
      
      if (isListItem) {
        // TOGGLE OFF: Convert list item back to paragraph
        const listItem = currentNode;
        const listParent = listItem.parentNode;
        const textContent = listItem.textContent || listItem.innerText || '';
        
        // Create a new paragraph
        const paragraph = document.createElement('p');
        paragraph.textContent = textContent;
        
        // Replace the list item with the paragraph
        listParent.replaceChild(paragraph, listItem);
        
        // If the list is now empty, remove it
        if (listParent.tagName && listParent.tagName.toLowerCase() === 'ul' && listParent.children.length === 0) {
          listParent.parentNode.removeChild(listParent);
        }
        
        // Move cursor to the new paragraph
        const newRange = document.createRange();
        newRange.selectNodeContents(paragraph);
        newRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        this.elements.editor.focus();
      } else {
        // TOGGLE ON: Convert current line to list item
        // Select the current paragraph/block
        if (currentNode && currentNode.nodeType === Node.ELEMENT_NODE) {
          const tempRange = document.createRange();
          tempRange.selectNodeContents(currentNode);
          selection.removeAllRanges();
          selection.addRange(tempRange);
        }

        // Insert unordered list (this will wrap the selected content in a list)
        document.execCommand('insertUnorderedList', false, null);
        
        // Move cursor to the end of the new list item
        try {
          const newRange = document.createRange();
          const listItems = editor.querySelectorAll('li');
          if (listItems.length > 0) {
            // Find the list item that contains our content
            let targetLi = null;
            for (const li of listItems) {
              if (li.textContent && li.textContent.trim()) {
                targetLi = li;
                break;
              }
            }
            if (!targetLi && listItems.length > 0) {
              targetLi = listItems[listItems.length - 1];
            }
            
            if (targetLi) {
              newRange.selectNodeContents(targetLi);
              newRange.collapse(false);
              selection.removeAllRanges();
              selection.addRange(newRange);
            }
          }
        } catch (err) {
          // Fallback: just focus the editor
          this.elements.editor.focus();
        }

        this.elements.editor.focus();
      }
    } catch (error) {
      console.error('Error toggling list item:', error);
      // Fallback: use execCommand
      try {
        // Try to detect if we're in a list and remove it, otherwise add it
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          let node = range.commonAncestorContainer;
          while (node && node !== this.elements.editor) {
            if (node.nodeType === Node.ELEMENT_NODE && node.tagName && node.tagName.toLowerCase() === 'li') {
              // In a list item, remove list formatting
              document.execCommand('outdent', false, null);
              break;
            }
            node = node.parentNode;
          }
          // If not in a list, add list formatting
          if (!node || node === this.elements.editor) {
            document.execCommand('insertUnorderedList', false, null);
          }
        }
        this.elements.editor.focus();
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
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
      
      // Get page title from current tab
      let pageTitle = '';
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.title) {
          pageTitle = tabs[0].title;
        }
      } catch (error) {
        console.debug('Could not get page title:', error);
      }
      
      // Prepare data to save
      const dataToSave = { [this.currentUrl]: content };
      
      // Save title separately with prefix
      if (pageTitle) {
        const titleKey = `title:${this.currentUrl}`;
        dataToSave[titleKey] = pageTitle;
      }
      
      // Use sync storage for persistence across extension disable/enable
      await chrome.storage.sync.set(dataToSave);
      this.showStatus('Gespeichert');
    } catch (error) {
      console.error('Error saving note:', error);
      // If sync storage quota exceeded, fall back to local storage
      if (error.message && error.message.includes('QUOTA_BYTES')) {
        try {
          const content = this.elements.editor.innerHTML;
          const dataToSave = { [this.currentUrl]: content };
          
          // Try to get and save title
          try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]?.title) {
              const titleKey = `title:${this.currentUrl}`;
              dataToSave[titleKey] = tabs[0].title;
            }
          } catch (titleError) {
            // Ignore title error in fallback
          }
          
          await chrome.storage.local.set(dataToSave);
          this.showStatus('Gespeichert (lokal)');
        } catch (localError) {
          this.showStatus('Fehler beim Speichern', true);
        }
      } else {
        this.showStatus('Fehler beim Speichern', true);
      }
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
      
      // Load note content and title
      const titleKey = `title:${url}`;
      let data = await chrome.storage.sync.get([url, titleKey]);
      
      if (!data[url]) {
        // Check local storage for migration
        const localData = await chrome.storage.local.get([url, titleKey]);
        if (localData[url]) {
          // Migrate from local to sync
          const migrateData = { [url]: localData[url] };
          if (localData[titleKey]) {
            migrateData[titleKey] = localData[titleKey];
          }
          await chrome.storage.sync.set(migrateData);
          data = migrateData;
        }
      }
      
      this.elements.editor.innerHTML = data[url] || '';
      
      // Update display with URL and title if available
      this.updateUrlDisplay(url, data[titleKey]);
    } catch (error) {
      console.error('Error loading note:', error);
      this.showStatus('Fehler beim Laden', true);
    }
  }

  updateUrlDisplay(url, pageTitle = null) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      this.elements.domainLabel.textContent = `Notizen für ${domain}`;
      
      // Show title if available, otherwise show URL
      if (pageTitle) {
        this.elements.urlLabel.textContent = `${pageTitle} - ${url}`;
      } else {
        this.elements.urlLabel.textContent = url;
      }
    } catch (error) {
      // Fallback if URL parsing fails
      this.elements.domainLabel.textContent = 'Notizen';
      if (pageTitle) {
        this.elements.urlLabel.textContent = `${pageTitle} - ${url}`;
      } else {
        this.elements.urlLabel.textContent = url;
      }
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

  async exportNotes() {
    try {
      // Get all notes from sync storage
      const syncData = await chrome.storage.sync.get(null);
      // Also check local storage for any remaining notes
      const localData = await chrome.storage.local.get(null);
      
      // Combine and filter out non-note keys
      const allNotes = {};
      const allTitles = {};
      const noteKeys = ['enabledDomains']; // Keys to exclude
      
      // Process sync data
      Object.keys(syncData).forEach(key => {
        if (!noteKeys.includes(key)) {
          if (key.startsWith('http')) {
            allNotes[key] = syncData[key];
          } else if (key.startsWith('title:http')) {
            // Extract URL from title key
            const url = key.replace('title:', '');
            allTitles[url] = syncData[key];
          }
        }
      });
      
      // Process local data (only if not in sync)
      Object.keys(localData).forEach(key => {
        if (!noteKeys.includes(key)) {
          if (key.startsWith('http') && !allNotes[key]) {
            allNotes[key] = localData[key];
          } else if (key.startsWith('title:http')) {
            const url = key.replace('title:', '');
            if (!allTitles[url]) {
              allTitles[url] = localData[key];
            }
          }
        }
      });
      
      // Structure export data with notes and titles
      const exportData = {
        version: '1.7',
        exportDate: new Date().toISOString(),
        notes: allNotes,
        titles: allTitles
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sticky-notes-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showStatus('Export erfolgreich');
    } catch (error) {
      console.error('Error exporting notes:', error);
      this.showStatus('Fehler beim Export', true);
    }
  }

  async importNotes(file) {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // Support both old format (just notes) and new format (notes + titles)
      const notes = importData.notes || importData;
      const titles = importData.titles || {};
      
      if (!notes || typeof notes !== 'object') {
        throw new Error('Ungültiges Dateiformat');
      }
      
      // Import notes and titles to sync storage
      const dataToImport = {};
      
      // Import notes
      Object.keys(notes).forEach(url => {
        if (url.startsWith('http')) {
          dataToImport[url] = notes[url];
          
          // Import title if available
          if (titles[url]) {
            const titleKey = `title:${url}`;
            dataToImport[titleKey] = titles[url];
          }
        }
      });
      
      if (Object.keys(dataToImport).length === 0) {
        throw new Error('Keine gültigen Notizen gefunden');
      }
      
      await chrome.storage.sync.set(dataToImport);
      
      // Reload current note if it was imported
      if (this.currentUrl && dataToImport[this.currentUrl]) {
        this.elements.editor.innerHTML = dataToImport[this.currentUrl];
        const titleKey = `title:${this.currentUrl}`;
        if (dataToImport[titleKey]) {
          this.updateUrlDisplay(this.currentUrl, dataToImport[titleKey]);
        }
      }
      
      const noteCount = Object.keys(notes).filter(url => url.startsWith('http')).length;
      this.showStatus(`${noteCount} Notizen importiert`);
    } catch (error) {
      console.error('Error importing notes:', error);
      this.showStatus('Fehler beim Import: ' + error.message, true);
    }
  }

  handleImportClick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        this.importNotes(file);
      }
    };
    input.click();
  }

  showInfo() {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const shortcutKey = isMac ? 'Cmd' : 'Ctrl';
    
    const message = `URL Context Notes v1.7\n\n` +
      `Speichern Sie Notizen für jede URL.\n` +
      `Notizen werden automatisch gespeichert.\n\n` +
      `Formatierung: Verwenden Sie die Toolbar-Buttons für Textformatierung.\n\n` +
      `Tastenkürzel:\n` +
      `${shortcutKey}+Shift+8 - Listenpunkt für aktuelle Zeile ein/ausschalten\n\n` +
      `Datenpersistenz: Notizen werden in Chrome Sync gespeichert und bleiben erhalten, wenn die Erweiterung deaktiviert wird. Für vollständige Sicherheit können Sie Ihre Notizen exportieren.`;
    
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
