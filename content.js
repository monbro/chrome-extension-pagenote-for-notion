// Check if there is a note for the current URL
(async function init() {
  try {
    const currentUrl = window.location.href;
    
    // Check sync storage first
    let data = await chrome.storage.sync.get(currentUrl);
    let content = data[currentUrl];

    // Fallback to local storage if not found
    if (!content) {
      data = await chrome.storage.local.get(currentUrl);
      content = data[currentUrl];
    }

    // If content exists and is not empty (stripping HTML tags)
    if (content && stripHtml(content).trim().length > 0) {
      showNotification();
    }
  } catch (error) {
    // Fail silently
  }
})();

function stripHtml(html) {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function showNotification() {
  // Create the notification element
  const notif = document.createElement('div');
  notif.className = '__url-context-notes-notice';
  notif.innerHTML = `
    <span class="icon">📝</span>
    <span class="text">Note available</span>
  `;
  
  // Handle click to open side panel
  notif.addEventListener('click', () => {
    try {
      chrome.runtime.sendMessage({ action: 'open_side_panel' });
      // Hide immediately on click
      notif.classList.remove('visible');
    } catch (e) {
      console.error('Error sending message:', e);
    }
  });

  document.body.appendChild(notif);

  // Animation sequence
  // 1. Slide in
  setTimeout(() => {
    notif.classList.add('visible');
  }, 500);

  // 2. Minimize to side after 4 seconds (silent mode)
  setTimeout(() => {
    // Only minimize if it's still in the DOM and hasn't been clicked
    if (document.body.contains(notif)) {
      notif.classList.add('minimized');
    }
  }, 4500);
}