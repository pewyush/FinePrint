/** Finds the page footer and pulls out Terms / Privacy / Policy links. */

import type { PolicyLink, ScanResult } from "../shared/messages.js";

/** Matches policy-ish anchor text and hrefs (terms, privacy, legal, cookies, …). */
const POLICY_TEXT =
  /\b(terms?(?:\s+(?:of|and|&)\s+(?:use|service|conditions))?|t&c(?:'s)?|tos|conditions(?:\s+of\s+use)?|privacy(?:\s+(?:policy|notice))?|cookie(?:s)?(?:\s+policy)?|legal(?:\s+(?:notice|policy|terms))?|eula|acceptable\s+use|refund(?:s)?(?:\s+policy)?|cancellation(?:\s+policy)?|gdpr|data\s+protection|imprint|disclaimer|corporate\s+governance)\b/i;

/** Stricter test used to decide whether the CURRENT page is a policy page. */
const POLICY_PAGE =
  /(terms(?:\s+(?:of|and|&)\s+(?:use|service|conditions))?(?:\s+and\s+conditions)?|privacy(?:\s+(?:policy|notice))?|cookie\s+policy|acceptable\s+use|eula)/i;

const MAX_LINKS = 12;
const SCHEME = /^(?:javascript:|mailto:|tel:|data:|#)/i;

function normalizeUrl(href: string): string {
  try {
    const url = new URL(href, location.href);
    url.hash = "";
    return url.href;
  } catch {
    return href;
  }
}

function prettyLabel(anchor: HTMLAnchorElement, url: string): string {
  const text = (anchor.innerText ?? anchor.textContent ?? "").replace(/\s+/g, " ").trim();
  if (text.length > 0) return text.slice(0, 90);
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split("/").filter(Boolean).pop() ?? parsed.hostname;
    return decodeURIComponent(last).replace(/[-_]+/g, " ").slice(0, 90);
  } catch {
    return url.slice(0, 90);
  }
}

/** All footer-ish containers on the page (semantic footer, ARIA, class/id hints). */
function findFooters(): Element[] {
  const candidates: Element[] = [];
  const push = (element: Element | null | undefined): void => {
    if (element && !candidates.includes(element)) candidates.push(element);
  };
  push(document.querySelector("footer"));
  document.querySelectorAll("[role='contentinfo']").forEach(push);
  document
    .querySelectorAll("div, section")
    .forEach((element) => {
      const hint = `${element.id} ${element.className}`;
      if (typeof hint === "string" && /footer|site-?foot|colophon/i.test(hint)) push(element);
    });
  return candidates;
}

function inAnyFooter(anchor: Element, footers: Element[]): boolean {
  return footers.some((footer) => footer.contains(anchor));
}

export function scanPage(): ScanResult {
  const footers = findFooters();
  const seen = new Set<string>();
  const found: PolicyLink[] = [];
  const anchors = Array.from(document.querySelectorAll("a[href]"));

  for (const anchor of anchors) {
    const href = anchor.getAttribute("href") ?? "";
    if (SCHEME.test(href)) continue;
    const url = normalizeUrl(href);
    if (seen.has(url)) continue;

    const label = prettyLabel(anchor as HTMLAnchorElement, url);
    const matches = POLICY_TEXT.test(label) || POLICY_TEXT.test(url);
    if (!matches) continue;

    seen.add(url);
    found.push({ url, label, inFooter: inAnyFooter(anchor, footers) });
  }

  // Footer links first, then document order — that is the order humans scan in.
  const ordered = found
    .map((link, index) => ({ link, index }))
    .sort((a, b) => {
      if (a.link.inFooter !== b.link.inFooter) return a.link.inFooter ? -1 : 1;
      return a.index - b.index;
    })
    .map((entry) => entry.link)
    .slice(0, MAX_LINKS);

  const heading = document.querySelector("h1")?.textContent ?? "";
  const isPolicyPage = POLICY_PAGE.test(
    `${location.href} ${document.title} ${heading}`,
  );

  return {
    url: location.href,
    title: document.title.trim() || location.hostname,
    links: ordered,
    isPolicyPage,
    pageTextLength: 0,
  };
}
