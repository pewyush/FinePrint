/**
 * DOM → readable plain text.
 * Used on the live page (content script) and on fetched HTML (side panel, DOMParser).
 */

const REMOVE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "canvas",
  "iframe",
  "object",
  "embed",
  "form",
  "button",
  "input",
  "select",
  "textarea",
  "nav",
  "header",
  "footer",
  "aside",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  "[aria-hidden='true']",
].join(",");

const BLOCK_TAGS = new Set([
  "address",
  "article",
  "blockquote",
  "dd",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "main",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tr",
  "ul",
]);

function walk(node: Node, out: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue ?? "";
    if (text.trim().length > 0) out.push(text);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  if (tag === "br") {
    out.push("\n");
    return;
  }
  if (tag === "li") out.push("\n- ");
  if (BLOCK_TAGS.has(tag)) out.push("\n");
  for (const child of Array.from(element.childNodes)) walk(child, out);
  if (BLOCK_TAGS.has(tag)) out.push("\n");
}

/**
 * Extract readable text from `root`, dropping chrome (nav/header/footer/forms).
 * Main/article content is preferred when the root is a full document.
 */
export function readableTextFrom(root: ParentNode): string {
  let container: Element | null = null;
  if (root instanceof Document) {
    container =
      root.querySelector("main, article, [role='main']") ?? root.body ?? root.documentElement;
  } else if (root instanceof Element) {
    container = root;
  }
  if (!container) return "";

  const clone = container.cloneNode(true) as Element;
  if (clone instanceof Element) {
    for (const junk of Array.from(clone.querySelectorAll(REMOVE_SELECTORS))) junk.remove();
  }

  const parts: string[] = [];
  walk(clone, parts);

  return parts
    .join("")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, index, all) => line.length > 0 || (index > 0 && (all[index - 1] ?? "").length > 0))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
