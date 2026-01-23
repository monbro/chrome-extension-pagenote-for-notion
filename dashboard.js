document.addEventListener('DOMContentLoaded', loadNotes);
document.getElementById('search').addEventListener('input', filterNotes);

let allNotes = [];

async function loadNotes() {
  try {
    // Fetch from both storages to ensure we have everything
    const syncData = await chrome.storage.sync.get(null);
    const localData = await chrome.storage.local.get(null);
    
    const notesMap = new Map();
    
    // Helper to process data objects
    const processData = (data) => {
      Object.keys(data).forEach(key => {
        // Filter for note keys (URLs)
        if (key.startsWith('http') && !key.startsWith('title:')) {
          const url = key;
          const content = data[key];
          const titleKey = `title:${url}`;
          // Get title from data, or fallback to hostname
          let title = data[titleKey];
          if (!title) {
            try {
              title = new URL(url).hostname;
            } catch (e) {
              title = url;
            }
          }
          
          if (!notesMap.has(url)) {
            notesMap.set(url, { url, content, title });
          }
        }
      });
    };

    processData(syncData);
    processData(localData); // Local acts as fallback/merge

    allNotes = Array.from(notesMap.values());
    renderNotes(allNotes);
  } catch (error) {
    console.error('Error loading notes for dashboard:', error);
  }
}

function renderNotes(notes) {
  const container = document.getElementById('notes-list');
  container.innerHTML = '';

  if (notes.length === 0) {
    container.innerHTML = '<div class="no-notes">No notes found. Visit websites and click the extension icon to start taking notes!</div>';
    return;
  }

  notes.forEach(note => {
    const card = document.createElement('div');
    card.className = 'note-card';
    
    // Create a temporary element to strip HTML tags for the preview
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = note.content;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    const previewText = textContent.trim() || '<i>(Empty note)</i>';
    
    card.innerHTML = `
      <div class="card-header">
        <div class="card-title" title="${escapeHtml(note.title)}">${escapeHtml(note.title)}</div>
        <a href="${note.url}" target="_blank" class="card-url" title="${escapeHtml(note.url)}">${escapeHtml(note.url)}</a>
      </div>
      <div class="card-preview">${previewText}</div>
      <div class="card-actions">
        <button class="btn open-btn">Open Page</button>
        <button class="btn btn-danger delete-btn">Delete</button>
      </div>
    `;
    
    // Add event listeners
    card.querySelector('.open-btn').addEventListener('click', () => {
      chrome.tabs.create({ url: note.url });
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
  await chrome.storage.sync.remove([url, `title:${url}`]);
  await chrome.storage.local.remove([url, `title:${url}`]);
  await loadNotes(); // Reload to refresh list
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}