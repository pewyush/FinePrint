/** Content-script entry: answers scan/extract requests from the side panel. */
import { extractPageText } from "./extract.js";
import { scanPage } from "./scan.js";
function handle(message) {
    switch (message.type) {
        case "FP_SCAN": {
            const result = scanPage();
            // Cheap win: measure the page text once so the panel can offer "this page".
            result.pageTextLength = extractPageText().length;
            return { ok: true, result };
        }
        case "FP_EXTRACT":
            return { ok: true, result: { text: extractPageText() } };
        default:
            return undefined;
    }
}
export function start() {
    if (window.__fineprintStarted)
        return;
    window.__fineprintStarted = true;
    // Debug hook (isolated world only) — used during manual verification and the demo.
    window.__fineprintDebug = { scanPage, extractPageText };
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        const response = handle(message);
        if (!response)
            return false;
        sendResponse(response);
        return false; // response is synchronous
    });
}
