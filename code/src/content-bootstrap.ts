/**
 * Content-script bootstrap.
 *
 * Content scripts are classic scripts, so the real module graph
 * (dist/content/main.js + its imports) is pulled in with a dynamic import().
 * Those files are listed in web_accessible_resources in manifest.json.
 */

void (async (): Promise<void> => {
  try {
    const moduleUrl = chrome.runtime.getURL("dist/content/main.js");
    const module = (await import(moduleUrl)) as { start?: () => void };
    module.start?.();
  } catch (error) {
    console.warn("[FinePrint] content module failed to load", error);
  }
})();
