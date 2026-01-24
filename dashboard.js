document.addEventListener('DOMContentLoaded', loadNotes);
document.getElementById('search').addEventListener('input', filterNotes);

let allNotes = [];
let isLoadingFromAPI = false;

async function loadNotes() {
  try {
    // Initialize Notion service
    await notionService.init();
    
    if (!notionService.isAuthenticated()) {
      document.getElementById('notes-list').innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <h2>🔗 Not Connected to Notion</h2>
          <p>Please set up your Notion integration first.</p>
          <a href="${chrome.runtime.getURL('notion-auth.html')}" target="_blank" style="
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 15px;
          ">Setup Notion Integration</a>
        </div>
      `;
      return;
    }
    
    // Load cached notes first for instant display
    const cachedNotes = await notionService.getAllCachedNotes();
    if (cachedNotes.length > 0) {
      console.log('Displaying cached notes:', cachedNotes.length);
      allNotes = cachedNotes;
      renderNotes(allNotes, true); // true = from cache
    }
    
    // Fetch fresh notes from Notion in background
    isLoadingFromAPI = true;
    loadNotesFromAPI();
  } catch (error) {
    console.error('Error loading notes for dashboard:', error);
    document.getElementById('notes-list').innerHTML = `
      <div class="no-notes" style="color: #d32f2f;">Error loading notes: ${error.message}</div>
    `;
  }
}

async function loadNotesFromAPI() {
  try {
    console.log('Starting API fetch for fresh notes...');
    
    // Fetch all notes from Notion
    const notes = await notionService.getAllNotes();
    console.log('Fetched notes from API:', notes.length);
    
    // Fetch content for each note
    const notesWithContent = await Promise.all(
      notes.map(async (note) => {
        try {
          const content = await notionService.getPageContent(note.id);
          return { ...note, content };
        } catch (error) {
          console.error('Error fetching content for note:', error);
          return { ...note, content: '' };
        }
      })
    );
    
    console.log('Fetched content for all notes');
    
    // Cache all notes with fresh data
    for (const note of notesWithContent) {
      await notionService.cacheNote(note.url, note);
      console.log('Cached note:', note.url);
    }
    
    // Replace in-memory notes with fresh API data
    allNotes = notesWithContent;
    console.log('Updated allNotes with fresh API data:', allNotes.length);
    
    // Re-render with fresh data (not from cache)
    isLoadingFromAPI = false;
    renderNotes(allNotes, false); // false = from API (no cache styling)
    console.log('Re-rendered dashboard with fresh API data');
  } catch (error) {
    console.error('Error loading notes from API:', error);
    isLoadingFromAPI = false;
  }
}

function renderNotes(notes, isFromCache = false) {
  const container = document.getElementById('notes-list');
  // Clear all existing content first
  container.innerHTML = '';
  console.log('Rendering', isFromCache ? 'cached' : 'fresh API', 'notes:', notes.length);

  if (notes.length === 0) {
    container.innerHTML = '<div class="no-notes">No notes found. Visit websites and click the extension icon to start taking notes!</div>';
    return;
  }

  // Show loading indicator if API is still fetching
  if (isFromCache && isLoadingFromAPI) {
    const loadingDiv = document.createElement('div');
    loadingDiv.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 10px; color: #999; font-size: 0.9em;';
    loadingDiv.textContent = 'Synchronisiere mit Notion...';
    container.appendChild(loadingDiv);
  }

  notes.forEach(note => {
    const card = document.createElement('div');
    card.className = 'note-card';
    
    // Only add from-cache class if rendering cached data
    if (isFromCache) {
      card.classList.add('from-cache');
      console.log('Added from-cache class to:', note.url);
    } else {
      card.classList.remove('from-cache');
    }
    
    // Create a temporary element to strip HTML tags for the preview
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = note.content;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    const previewText = textContent.trim() || '<i>(Empty note)</i>';
    
    // Format dates from Notion (ISO 8601)
    const formatDate = (isoString) => {
      if (!isoString) return '';
      try {
        const date = new Date(isoString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      } catch (e) {
        return isoString.split('T')[0]; // Fallback to date part only
      }
    };
    
    const createdDate = note.created ? formatDate(note.created) : '';
    const modifiedDate = note.modified ? formatDate(note.modified) : '';
    
    card.innerHTML = `
      <div class="card-header">
        <div class="card-title" title="${escapeHtml(note.title)}">${escapeHtml(note.title)}</div>
        <a href="${note.url}" target="_blank" class="card-url" title="${escapeHtml(note.url)}">${escapeHtml(note.url)}</a>
      </div>
      <div class="card-preview">${previewText}</div>
      <div class="card-metadata">
        ${createdDate ? `<span class="card-date">Created: ${createdDate}</span>` : ''}
        ${modifiedDate ? `<span class="card-date">Modified: ${modifiedDate}</span>` : ''}
      </div>
      <div class="card-actions">
        <button class="btn open-web-btn">Open Website</button>
        <button class="btn open-notion-btn">View in Notion</button>
        <button class="btn btn-danger delete-btn">Delete</button>
      </div>
    `;
    
    // Add event listeners
    card.querySelector('.open-web-btn').addEventListener('click', () => {
      chrome.tabs.create({ url: note.url });
    });
    
    card.querySelector('.open-notion-btn').addEventListener('click', () => {
      // Open the Notion page directly
      const notionUrl = `https://www.notion.so/${note.id.replace(/-/g, '')}`;
      chrome.tabs.create({ url: notionUrl });
    });
    
    card.querySelector('.delete-btn').addEventListener('click', async () => {
      if (confirm(`Delete note for ${note.title}?`)) {
        await deleteNote(note.url);
      }
    });
    
    container.appendChild(card);
  });
}

function filterNotes(e) {
  const term = e.target.value.toLowerCase();
  const filtered = allNotes.filter(note => 
    note.url.toLowerCase().includes(term) || 
    note.title.toLowerCase().includes(term) || 
    note.content.toLowerCase().includes(term)
  );
  renderNotes(filtered);
}

async function deleteNote(url) {
  try {
    // Find the note by URL
    const note = allNotes.find(n => n.url === url);
    if (note && note.id) {
      await notionService.deleteNote(note.id);
      // Reload notes
      await loadNotes();
    }
  } catch (error) {
    console.error('Error deleting note:', error);
    alert('Error deleting note: ' + error.message);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}