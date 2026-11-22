/** Background service worker: opens the side panel when the toolbar icon is clicked. */
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.warn("[FinePrint] could not wire side panel", error));
export {};
