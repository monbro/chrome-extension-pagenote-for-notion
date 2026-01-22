let currentUrl = "";
const editor = document.getElementById('note-editor');
const urlLabel = document.getElementById('url-label');
const statusMsg = document.getElementById('status');

function format(command) {
  document.execCommand(command, false, null);
  editor.focus();
}

// Event Listener für Toolbar
document.getElementById('btn-bold').addEventListener('click', () => format('bold'));
document.getElementById('btn-italic').addEventListener('click', () => format('italic'));
document.getElementById('btn-underline').addEventListener('click', () => format('underline'));
document.getElementById('btn-list').addEventListener('click', () => format('insertUnorderedList'));
document.getElementById('btn-indent').addEventListener('click', () => format('indent'));
document.getElementById('btn-outdent').addEventListener('click', () => format('outdent'));

async function loadNote(url) {
  if (!url || url.startsWith('chrome://') || url.startsWith('brave://')) return;
  currentUrl = url;
  urlLabel.textContent = url;
  
  const data = await chrome.storage.local.get(url);
  editor.innerHTML = data[url] || "";
}

editor.addEventListener('input', () => {
  if (!currentUrl) return;
  chrome.storage.local.set({ [currentUrl]: editor.innerHTML }, () => {
    statusMsg.classList.add('visible');
    setTimeout(() => statusMsg.classList.remove('visible'), 800);
  });
});

// Initiales Laden
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) loadNote(tabs[0].url);
});