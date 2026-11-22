/** Message contract between the side panel and the content script. */

export interface PolicyLink {
  url: string;
  label: string;
  /** True when the link was found inside the page footer. */
  inFooter: boolean;
}

export interface ScanResult {
  url: string;
  title: string;
  links: PolicyLink[];
  isPolicyPage: boolean;
  /** Length of the readable text on the current page (0 if extraction failed). */
  pageTextLength: number;
}

export interface ExtractResult {
  text: string;
}

export type ContentRequestType = "FP_SCAN" | "FP_EXTRACT";

export interface ContentRequest {
  type: ContentRequestType;
}

export type ContentResponse =
  | { ok: true; result: ScanResult | ExtractResult }
  | { ok: false; error: string };

export function isScanResult(value: unknown): value is ScanResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ScanResult>;
  return Array.isArray(candidate.links) && typeof candidate.url === "string";
}

export function isExtractResult(value: unknown): value is ExtractResult {
  if (typeof value !== "object" || value === null) return false;
  return typeof (value as Partial<ExtractResult>).text === "string";
}
