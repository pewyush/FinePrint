/** Section-aware text chunking: headings and paragraphs are kept together. */
const DEFAULT_MAX_CHARS = 3200;
/** Collapse runs of blank lines so paragraphs become reliable split points. */
export function normalizeText(text) {
    return text
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
function isHeading(block) {
    const single = block.trim();
    if (single.length === 0 || single.length > 80)
        return false;
    if (single.includes("\n"))
        return false;
    // Short standalone lines that do not end with sentence punctuation read as headings.
    return !/[.;:,]$/.test(single) && /^[#*\d.\s)*-]*\S/.test(single);
}
/** Hard-split an oversized block on sentence boundaries, then on words. */
function splitOversized(block, maxChars) {
    if (block.length <= maxChars)
        return [block];
    const parts = [];
    const sentences = block.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [block];
    let current = "";
    for (const sentence of sentences) {
        if (current.length + sentence.length > maxChars && current.length > 0) {
            parts.push(current.trim());
            current = "";
        }
        current += sentence;
    }
    if (current.trim().length > 0)
        parts.push(current.trim());
    // Sentences longer than the limit (legal boilerplate) fall back to word packing.
    const final = [];
    for (const part of parts) {
        if (part.length <= maxChars) {
            final.push(part);
            continue;
        }
        const words = part.split(/\s+/);
        let window = "";
        for (const word of words) {
            if (window.length + word.length + 1 > maxChars && window.length > 0) {
                final.push(window.trim());
                window = "";
            }
            window += `${word} `;
        }
        if (window.trim().length > 0)
            final.push(window.trim());
    }
    return final;
}
/**
 * Split `text` into chunks of at most `maxChars`.
 * Paragraphs are packed greedily; a heading stays attached to the block after it.
 */
export function chunkText(text, options = {}) {
    const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
    const normalized = normalizeText(text);
    if (normalized.length === 0)
        return [];
    const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
    const chunks = [];
    let current = "";
    const flush = () => {
        if (current.trim().length > 0)
            chunks.push(current.trim());
        current = "";
    };
    for (let i = 0; i < blocks.length; i += 1) {
        const block = blocks[i] ?? "";
        const next = blocks[i + 1] ?? "";
        let piece = block;
        // Keep a heading glued to the paragraph it introduces.
        if (isHeading(block) && next.length > 0 && current.length + block.length + next.length <= maxChars) {
            piece = `${block}\n\n${next}`;
            i += 1;
        }
        if (piece.length > maxChars) {
            flush();
            chunks.push(...splitOversized(piece, maxChars));
            continue;
        }
        if (current.length + piece.length + 2 > maxChars)
            flush();
        current = current.length > 0 ? `${current}\n\n${piece}` : piece;
    }
    flush();
    return chunks;
}
