/** Background service worker: opens the side panel when the toolbar icon is clicked. */

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => console.warn("[FinePrint] could not wire side panel", error));
