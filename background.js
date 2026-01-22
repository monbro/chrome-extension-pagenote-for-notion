// 1. Verhalten festlegen: Klick auf Icon öffnet das Sidepanel
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// 2. Beim Installieren/Starten: Erstmal überall deaktivieren
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({ enabled: false });
});

// 3. Wenn ein neuer Tab erstellt wird: Sidepanel dort deaktiviert lassen
chrome.tabs.onCreated.addListener((tab) => {
  chrome.sidePanel.setOptions({
    tabId: tab.id,
    enabled: false
  });
});

// 4. Der Trick für den "Ein-Klick": 
// Wenn du auf das Icon klickst, aktivieren wir es NUR für diesen Tab.
// Da 'openPanelOnActionClick' aktiv ist, öffnet Chrome es sofort im selben Moment.
chrome.action.onClicked.addListener(async (tab) => {
  const isEnabled = await getPanelStatus(tab.id);

  if (!isEnabled) {
    // Aktivieren für diesen Tab
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: 'sidepanel.html',
      enabled: true
    });
    // Chrome öffnet es jetzt automatisch durch das 'PanelBehavior'
  } else {
    // Wenn es schon aktiv war, schließen wir es (Toggle-Funktion)
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      enabled: false
    });
  }
});

// Hilfsfunktion um zu prüfen, ob das Panel für einen Tab aktiv ist
async function getPanelStatus(tabId) {
  try {
    const options = await chrome.sidePanel.getOptions({ tabId: tabId });
    return options.enabled;
  } catch (e) {
    return false;
  }
}