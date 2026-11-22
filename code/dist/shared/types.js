/** Domain types shared by the extension UI, the pipeline and the CLI runner. */
export const DISCLAIMER = "This is an automated plain-language summary, not legal advice. Check the original document for anything that matters to you.";
export const CATEGORY_LABELS = {
    data_sharing: "Data sharing",
    auto_renewal: "Auto-renewal / billing",
    arbitration: "Arbitration / dispute",
    cancellation: "Cancellation / refunds",
    liability: "Liability",
    unbounded_changes: "Company can change terms freely",
    other: "Other",
};
export const CATEGORY_IDS = [
    "data_sharing",
    "auto_renewal",
    "arbitration",
    "cancellation",
    "liability",
    "unbounded_changes",
    "other",
];
export const SEVERITY_ORDER = {
    high: 0,
    medium: 1,
    low: 2,
    info: 3,
};
