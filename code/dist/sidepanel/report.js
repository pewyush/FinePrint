/** Renders one SourceReport as a card in the side panel. */
import { CATEGORY_LABELS } from "../shared/types.js";
import { h } from "./ui.js";
function severityBadge(severity) {
    return h("span", { class: `badge severity-${severity}`, text: severity });
}
function riskCard(risk) {
    return h("article", { class: "risk" }, [
        h("header", { class: "risk-head" }, [
            h("span", { class: "risk-cat", text: CATEGORY_LABELS[risk.category] }),
            severityBadge(risk.severity),
        ]),
        h("p", { class: "risk-why", text: risk.explanation }),
        h("blockquote", { class: "risk-quote", text: `“${risk.clauseQuote}”` }),
    ]);
}
function reportToMarkdown(report) {
    const lines = [];
    lines.push(`# FinePrint report — ${report.title}`);
    lines.push("");
    lines.push(report.url);
    lines.push("");
    lines.push(report.summary);
    lines.push("");
    if (report.keyPoints.length > 0) {
        lines.push("## Key points");
        for (const point of report.keyPoints)
            lines.push(`- ${point}`);
        lines.push("");
    }
    if (report.risks.length > 0) {
        lines.push("## Risks");
        for (const risk of report.risks) {
            lines.push(`- **${CATEGORY_LABELS[risk.category]} (${risk.severity})** — ${risk.explanation}`);
            lines.push(`  > ${risk.clauseQuote}`);
        }
        lines.push("");
    }
    if (report.notMentioned.length > 0) {
        lines.push(`Not mentioned: ${report.notMentioned.map((id) => CATEGORY_LABELS[id]).join(", ")}`);
        lines.push("");
    }
    lines.push(`_${report.disclaimer}_`);
    return lines.join("\n");
}
export function renderReportCard(report) {
    const stats = [
        `${report.chunkCount} chunk${report.chunkCount === 1 ? "" : "s"}`,
        `${report.risks.length} risk flag${report.risks.length === 1 ? "" : "s"}`,
    ];
    if (report.failedChunks > 0)
        stats.push(`${report.failedChunks} chunk failed`);
    if (report.droppedUngrounded > 0) {
        stats.push(`${report.droppedUngrounded} ungrounded citation dropped`);
    }
    if (report.mergedLocally)
        stats.push("fallback merge (P2 failed)");
    return h("section", { class: "report" }, [
        h("h2", { class: "report-title", text: report.title }),
        h("a", {
            class: "report-url",
            href: report.url,
            text: report.url,
            title: report.url,
        }),
        h("p", { class: "report-summary", text: report.summary }),
        report.keyPoints.length > 0
            ? h("ul", {
                class: "key-points",
            }, report.keyPoints.map((point) => h("li", { text: point })))
            : null,
        h("h3", { class: "section-label", text: "Risk flags" }),
        report.risks.length > 0
            ? h("div", { class: "risks" }, report.risks.map(riskCard))
            : h("p", { class: "muted", text: "No risk flags found in this document." }),
        report.notMentioned.length > 0
            ? h("p", { class: "not-mentioned" }, [
                h("span", { class: "section-label", text: "Not mentioned: " }),
                ...report.notMentioned.map((id) => h("span", { class: "chip", text: CATEGORY_LABELS[id] })),
            ])
            : null,
        h("footer", { class: "report-foot" }, [
            h("span", { class: "muted stats", text: stats.join(" · ") }),
            h("button", {
                class: "ghost",
                type: "button",
                text: "Copy report",
                onClick: () => {
                    void navigator.clipboard.writeText(reportToMarkdown(report));
                },
            }),
        ]),
        h("p", { class: "disclaimer", text: report.disclaimer }),
    ]);
}
