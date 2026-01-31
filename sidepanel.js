/**
 * Sticky Notes Side Panel - Main Application Logic
 * Manages note editing, saving, and formatting for URL-specific notes
 */

class NoteEditor {
  constructor() {
    this.currentUrl = '';
    this.saveTimeout = null;
    this.debounceDelay = 500; // ms
    this.isSaving = false;
    this.lastSavedContent = '';
    
    this.elements = {
      editor: document.getElementById('note-editor'),
      urlLabel: document.getElementById('url-label'),
      domainLabel: document.getElementById('domain-label'),
      statusMsg: document.getElementById('status'),
      infoBtn: document.getElementById('close-btn'),
      viewNotionBtn: document.getElementById('view-notion-btn'),
      saveIndicator: document.getElementById('save-indicator')
    };

    this.init();
  }

  async init() {
    this.setupEventListeners();
    await notionService.init();
    
    // Disable editor until content is loaded
    this.elements.editor.contentEditable = false;
    this.elements.editor.style.opacity = '0.5';
    this.elements.editor.style.cursor = 'wait';
    this.updateSaveIndicator('loading');
    
    // Check if user is authenticated with Notion
    if (!notionService.isAuthenticated()) {
      this.showAuthPrompt();
      return;
    }
    
    this.loadCurrentTabNote();
    this.setupPlaceholder();
    this.injectDashboardButton();
  }

  async migrateFromLocalStorage() {
    try {
      // Migrate all notes from local to sync storage
      const localData = await chrome.storage.local.get(null);
      const notesToMigrate = {};
      const noteKeys = ['enabledDomains', 'notionApiKey', 'notionDatabaseId']; // Keys to exclude
      
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

  showAuthPrompt() {
    this.elements.editor.style.display = 'none';
    const authPrompt = document.createElement('div');
    authPrompt.id = 'auth-prompt';
    authPrompt.style.cssText = `
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 14px;
      line-height: 1.6;
    `;
    authPrompt.innerHTML = `
      <h2 style="color: #333; margin-bottom: 15px; font-size: 18px;">🔗 Connect to Notion</h2>
      <p style="margin-bottom: 10px;">To use this extension, you need to connect it to your Notion workspace.</p>
      <p style="margin-bottom: 20px;">Click the button below to set up your credentials.</p>
      <button id="open-auth-btn" style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
      ">Setup Notion Integration</button>
    `;
    
    const container = document.querySelector('[data-testid="sidepanel"]') || this.elements.editor.parentNode;
    container.insertBefore(authPrompt, this.elements.editor);
    
    document.getElementById('open-auth-btn').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('notion-auth.html') });
    });
  }

  setupPlaceholder() {
    const placeholder = this.elements.editor.getAttribute('data-placeholder');
    if (placeholder) {
      this.elements.editor.setAttribute('data-placeholder', placeholder);
    }
  }

  injectDashboardButton() {
    // Find the toolbar by looking for one of the existing buttons
    const viewNotionBtn = this.elements.viewNotionBtn;
    if (viewNotionBtn && viewNotionBtn.parentNode) {
      const dashboardBtn = document.createElement('button');
      dashboardBtn.id = 'dashboard-btn';
      dashboardBtn.innerHTML = '📊'; // Chart icon
      dashboardBtn.title = 'Open Notes Dashboard';
      dashboardBtn.style.marginRight = '2px';
      
      dashboardBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
      
      // Insert before the view notion button
      viewNotionBtn.parentNode.insertBefore(dashboardBtn, viewNotionBtn);
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

    // View in Notion button
    if (this.elements.viewNotionBtn) {
      this.elements.viewNotionBtn.addEventListener('click', () => this.openInNotion());
    }

    // Keyboard shortcuts
    this.elements.editor.addEventListener('keydown', (e) => this.handleKeyDown(e));
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

    // Check if content has changed from last save
    if (this.elements.editor.innerHTML !== this.lastSavedContent) {
      this.updateSaveIndicator('unsaved');
    }

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

    this.isSaving = true;

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
      
      // Show saving indicator
      this.updateSaveIndicator('saving');
      this.showStatus('Synchronisiere mit Notion...');
      
      // Cache locally first with timestamp
      const noteData = {
        id: null, // Will be set by API
        title: pageTitle || this.currentUrl,
        url: this.currentUrl,
        content: content,
        lastSaved: Date.now() // Track when we last saved locally
      };
      await notionService.cacheNote(this.currentUrl, noteData);
      console.log('Note cached locally:', this.currentUrl);
      
      // Send save to background worker - it continues even if panel closes
      chrome.runtime.sendMessage({
        action: 'save_note_to_notion',
        url: this.currentUrl,
        content: content,
        pageTitle: pageTitle
      }, (response) => {
        if (response?.success) {
          // Only show success after background worker confirms API saved
          console.log('Note saved to Notion by background:', this.currentUrl);
          this.lastSavedContent = content;
          this.isSaving = false;
          this.updateSaveIndicator('saved');
          this.showStatus('Gespeichert');
        } else {
          console.error('Background save failed:', response?.error);
          this.isSaving = false;
          this.updateSaveIndicator('error');
          this.showStatus('Fehler beim Speichern zu Notion: ' + (response?.error || 'Unknown error'), true);
        }
      });
      
    } catch (error) {
      console.error('Error in saveNote:', error);
      this.isSaving = false;
      this.updateSaveIndicator('error');
      this.showStatus('Fehler beim Speichern', true);
    }
  }

  showStatus(message, isError = false, isCache = false) {
    this.elements.statusMsg.textContent = message;
    this.elements.statusMsg.classList.toggle('error', isError);
    this.elements.statusMsg.classList.toggle('cache', isCache);
    this.elements.statusMsg.classList.add('visible');
    
    setTimeout(() => {
      this.elements.statusMsg.classList.remove('visible');
      if (isError) {
        this.elements.statusMsg.classList.remove('error');
      }
      if (isCache) {
        this.elements.statusMsg.classList.remove('cache');
      }
    }, 2000);
  }

  async loadNote(url) {
    // Skip chrome:// and other special URLs
    if (!url || url.startsWith('chrome://') || url.startsWith('brave://') || 
        url.startsWith('edge://') || url.startsWith('about:')) {
      this.elements.editor.innerHTML = '';
      this.elements.editor.contentEditable = false;
      this.elements.urlLabel.textContent = 'Nicht verfügbar für diese Seite';
      this.elements.domainLabel.textContent = 'Notizen';
      this.currentUrl = '';
      this.updateSaveIndicator('loading');
      return;
    }

    try {
      this.currentUrl = url;
      
      // First, try to load from cache for instant display
      const cachedNote = await notionService.getCachedNote(url);
      if (cachedNote) {
        console.log('Displaying cached note for:', url);
        this.elements.editor.innerHTML = cachedNote.content || '';
        this.elements.editor.classList.add('from-cache');
        this.lastSavedContent = cachedNote.content || '';
        this.updateUrlDisplay(url, cachedNote.title);
        
        // Enable editor with cache state
        this.elements.editor.contentEditable = true;
        this.elements.editor.style.opacity = '1';
        this.elements.editor.style.cursor = 'text';
        this.updateSaveIndicator('saved');
        
        // Add cache indicator
        this.showStatus('Aus Speicher geladen...', false, true);
      } else {
        // No cache, show loading state
        this.updateSaveIndicator('loading');
      }
      
      // Now load from Notion API in background
      this.loadNoteFromAPI(url);
    } catch (error) {
      console.error('Error loading note:', error);
      this.showStatus('Fehler beim Laden', true);
      this.elements.editor.innerHTML = '';
      this.updateSaveIndicator('error');
      // Still enable editor so user can retry
      this.elements.editor.contentEditable = true;
      this.elements.editor.style.opacity = '1';
      this.elements.editor.style.cursor = 'text';
    }
  }

  async loadNoteFromAPI(url) {
    try {
      // Load note from Notion API
      const note = await notionService.getNoteByUrl(url);
      
      if (note) {
        // Get the full content
        const content = await notionService.getPageContent(note.id);
        
        // Cache the note
        await notionService.cacheNote(url, {
          id: note.id,
          title: note.title,
          url: url,
          content: content || ''
        });
        
        // Update UI with API data
        this.elements.editor.innerHTML = content || '';
        this.elements.editor.classList.remove('from-cache');
        this.lastSavedContent = content || '';
        this.updateUrlDisplay(url, note.title);
      } else {
        // No note exists yet
        this.elements.editor.innerHTML = '';
        this.elements.editor.classList.remove('from-cache');
        this.lastSavedContent = '';
        this.updateUrlDisplay(url);
        
        // Cache empty note
        await notionService.cacheNote(url, {
          id: null,
          title: url,
          url: url,
          content: ''
        });
      }
      
      // Enable editor and update indicator
      this.elements.editor.contentEditable = true;
      this.elements.editor.style.opacity = '1';
      this.elements.editor.style.cursor = 'text';
      this.updateSaveIndicator('saved');
      this.showStatus('Synchronisiert', false);
    } catch (error) {
      console.error('Error loading note from API:', error);
      this.updateSaveIndicator('error');
      this.showStatus('Fehler beim Synchronisieren', true);
      // Editor should already be enabled from cache, keep it that way
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

  updateSaveIndicator(status) {
    const indicator = this.elements.saveIndicator;
    
    switch(status) {
      case 'loading':
        indicator.textContent = '⏳';
        indicator.title = 'Lädt...';
        indicator.style.color = '#999';
        indicator.style.fontSize = '16px';
        indicator.setAttribute('data-saving', 'true');
        break;
      case 'saving':
        indicator.textContent = '💾';
        indicator.title = 'Speichert...';
        indicator.style.color = '#FF9800';
        indicator.style.fontSize = '16px';
        indicator.setAttribute('data-saving', 'true');
        break;
      case 'saved':
        indicator.textContent = '✅';
        indicator.title = 'Gespeichert';
        indicator.style.color = '#4CAF50';
        indicator.style.fontSize = '16px';
        indicator.setAttribute('data-saving', 'false');
        break;
      case 'unsaved':
        indicator.textContent = '⭕';
        indicator.title = 'Nicht gespeichert';
        indicator.style.color = '#FF5252';
        indicator.style.fontSize = '16px';
        indicator.setAttribute('data-saving', 'false');
        break;
      case 'error':
        indicator.textContent = '❌';
        indicator.title = 'Fehler beim Speichern';
        indicator.style.color = '#F44336';
        indicator.style.fontSize = '16px';
        indicator.setAttribute('data-saving', 'false');
        break;
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

  openInNotion() {
    if (!this.currentUrl) {
      this.showStatus('Keine URL für diese Notiz verfügbar', true);
      return;
    }

    // Find the note and open it in Notion
    (async () => {
      try {
        const note = await notionService.getNoteByUrl(this.currentUrl);
        if (note) {
          const notionUrl = `https://www.notion.so/${note.id.replace(/-/g, '')}`;
          chrome.tabs.create({ url: notionUrl });
        } else {
          this.showStatus('Notiz noch nicht in Notion gespeichert', true);
        }
      } catch (error) {
        console.error('Error opening note in Notion:', error);
        this.showStatus('Fehler beim Öffnen der Notion-Seite', true);
      }
    })();
  }

  showInfo() {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const shortcutKey = isMac ? 'Cmd' : 'Ctrl';
    
    const message = `PageNote for Notion v2.0\n\n` +
      `Speichern Sie Notizen für jede URL in Notion.\n` +
      `Notizen werden automatisch in Ihrer Notion-Datenbank gespeichert.\n\n` +
      `Formatierung: Verwenden Sie die Toolbar-Buttons für Textformatierung.\n\n` +
      `Tastenkürzel:\n` +
      `${shortcutKey}+Shift+8 - Listenpunkt für aktuelle Zeile ein/ausschalten\n\n` +
      `Notion Integration: Klicken Sie auf den "🔗 Notion" Button, um diese Notiz in Ihrer Notion-Datenbank zu öffnen.`;
    
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
