/** Message contract between the side panel and the content script. */
export function isScanResult(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const candidate = value;
    return Array.isArray(candidate.links) && typeof candidate.url === "string";
}
export function isExtractResult(value) {
    if (typeof value !== "object" || value === null)
        return false;
    return typeof value.text === "string";
}
