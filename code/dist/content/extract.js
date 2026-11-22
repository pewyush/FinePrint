/** Extracts the readable text of the page the content script is attached to. */
import { readableTextFrom } from "../shared/domText.js";
export function extractPageText() {
    const root = document.querySelector("main, article, [role='main']") ??
        document.body ??
        document.documentElement;
    if (!root)
        return "";
    return readableTextFrom(root);
}
