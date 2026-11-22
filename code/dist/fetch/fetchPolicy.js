/** Cross-origin fetching of policy documents from the extension origin. */
export class UnsupportedContentError extends Error {
    constructor(message) {
        super(message);
        this.name = "UnsupportedContentError";
    }
}
const UNSUPPORTED = /(application\/pdf|image\/|audio\/|video\/|application\/zip)/i;
/** Fetch a document with a timeout. Throws UnsupportedContentError for non-text types. */
export async function fetchDocument(url, timeoutMs = 15_000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
        response = await fetch(url, {
            redirect: "follow",
            credentials: "omit",
            signal: controller.signal,
            headers: { accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5" },
        });
    }
    catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Could not fetch ${url}: ${detail}`);
    }
    finally {
        clearTimeout(timer);
    }
    if (!response.ok) {
        throw new Error(`Could not fetch ${url}: HTTP ${response.status}`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (UNSUPPORTED.test(contentType)) {
        throw new UnsupportedContentError(`${url} is not a readable text page (${contentType.split(";")[0] ?? contentType}).`);
    }
    const body = await response.text();
    return { finalUrl: response.url || url, contentType, body };
}
