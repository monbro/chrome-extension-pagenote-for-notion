// Check if there is a note for the current URL
(async function init() {
  try {
    const currentUrl = window.location.href;
    
    // Send message to background worker to check if note exists
    chrome.runtime.sendMessage(
      { action: 'check_note_exists', url: currentUrl },
      (response) => {
        if (response && response.noteExists) {
          showNotification();
        }
      }
    );
  } catch (error) {
    console.error('Error checking for note:', error);
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
    <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></span>
    <span class="text">Note available</span>
  `;
  
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