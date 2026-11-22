/** HTML string → readable plain text (side panel runs this via DOMParser). */

import { readableTextFrom } from "../shared/domText.js";

export function htmlToText(html: string): string {
  const document = new DOMParser().parseFromString(html, "text/html");
  return readableTextFrom(document);
}
