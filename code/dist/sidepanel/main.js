/** Side panel app: scan the page footer → pick sources → run the pipeline → render. */
import { fetchDocument, UnsupportedContentError } from "../fetch/fetchPolicy.js";
import { htmlToText } from "../fetch/htmlToText.js";
import { isConfigured, loadConfig } from "../shared/config.js";
import { isExtractResult, isScanResult, } from "../shared/messages.js";
import { analyzeSource } from "../shared/pipeline.js";
import { h, replace } from "./ui.js";
import { renderReportCard } from "./report.js";
const CURRENT_PAGE_KEY = "__current__";
const state = {
    phase: "boot",
    tabId: null,
    scan: null,
    selected: new Set(),
    config: null,
    progress: null,
    reports: [],
    problems: [],
    error: null,
};
const root = document.getElementById("app");
function requireRoot() {
    if (!root)
        throw new Error("#app container missing");
    return root;
}
async function sendToContent(tabId, type) {
    const response = (await chrome.tabs.sendMessage(tabId, { type }));
    if (!response)
        throw new Error("No response from the page. Reload the tab and try again.");
    if (!response.ok)
        throw new Error(response.error);
    return response.result;
}
async function extractCurrentPage() {
    if (state.tabId === null)
        throw new Error("No active tab.");
    const result = await sendToContent(state.tabId, "FP_EXTRACT");
    if (!isExtractResult(result))
        throw new Error("Unexpected response from the page.");
    return result.text;
}
async function boot() {
    state.config = await loadConfig();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? "";
    if (!tab || tab.id === undefined || !/^https?:/i.test(url)) {
        state.phase = "unsupported";
        render();
        return;
    }
    state.tabId = tab.id;
    try {
        const scan = await sendToContent(tab.id, "FP_SCAN");
        if (!isScanResult(scan))
            throw new Error("Unexpected response from the page.");
        state.scan = scan;
        state.phase = "ready";
        // Pre-tick footer links and the current page when it already looks like a policy page.
        for (const link of scan.links)
            if (link.inFooter)
                state.selected.add(link.url);
        if (scan.isPolicyPage && scan.pageTextLength > 500)
            state.selected.add(CURRENT_PAGE_KEY);
        if (state.selected.size === 0 && scan.links.length > 0 && scan.links[0]) {
            state.selected.add(scan.links[0].url);
        }
    }
    catch (error) {
        state.error =
            error instanceof Error
                ? `${error.message} (reload the page so FinePrint can attach, then reopen the panel)`
                : String(error);
        state.phase = "error";
    }
    render();
}
function toggleSelection(key, checked) {
    if (checked)
        state.selected.add(key);
    else
        state.selected.delete(key);
    render();
}
async function collectSources() {
    const scan = state.scan;
    if (!scan)
        throw new Error("Page was not scanned.");
    const sources = [];
    const problems = [];
    if (state.selected.has(CURRENT_PAGE_KEY)) {
        try {
            const text = await extractCurrentPage();
            if (text.trim().length < 200)
                problems.push("Current page has almost no readable text.");
            else
                sources.push({ title: scan.title, url: scan.url, text });
        }
        catch (error) {
            problems.push(`Current page: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    const pageUrl = scan.url.replace(/#.*$/, "").replace(/\/$/, "");
    for (const link of scan.links) {
        if (!state.selected.has(link.url))
            continue;
        const linkUrl = link.url.replace(/#.*$/, "").replace(/\/$/, "");
        if (linkUrl === pageUrl)
            continue; // already handled as the current page
        try {
            const document = await fetchDocument(link.url);
            const text = document.contentType.includes("html")
                ? htmlToText(document.body)
                : document.body;
            if (text.trim().length < 200) {
                problems.push(`${link.label}: fetched page has almost no readable text.`);
                continue;
            }
            sources.push({ title: link.label, url: document.finalUrl, text });
        }
        catch (error) {
            if (error instanceof UnsupportedContentError)
                problems.push(error.message);
            else
                problems.push(`${link.label}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return { sources, problems };
}
async function runAnalysis() {
    if (!state.config)
        return;
    state.phase = "running";
    state.problems = [];
    state.reports = [];
    state.progress = { phase: "chunking", done: 0, total: 0, label: "Collecting sources" };
    render();
    try {
        const { sources, problems } = await collectSources();
        state.problems.push(...problems);
        if (sources.length === 0) {
            state.phase = "ready";
            state.error = "Nothing analysable: every selected source failed to load.";
            render();
            return;
        }
        for (const source of sources) {
            try {
                const report = await analyzeSource(source, {
                    config: state.config,
                    onProgress: (progress) => {
                        state.progress = progress;
                        render();
                    },
                });
                state.reports.push(report);
            }
            catch (error) {
                state.problems.push(`${source.title}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        state.phase = "done";
    }
    catch (error) {
        state.error = error instanceof Error ? error.message : String(error);
        state.phase = "ready";
    }
    state.progress = null;
    render();
}
function linkRow(link) {
    const checked = state.selected.has(link.url);
    return h("label", { class: "source-row" }, [
        h("input", {
            type: "checkbox",
            checked,
            onChange: (event) => toggleSelection(link.url, event.target.checked),
        }),
        h("span", { class: "source-label", text: link.label, title: link.url }),
        h("span", { class: "source-tag", text: link.inFooter ? "footer" : "page" }),
    ]);
}
function currentRow(scan) {
    const checked = state.selected.has(CURRENT_PAGE_KEY);
    return h("label", { class: "source-row" }, [
        h("input", {
            type: "checkbox",
            checked,
            onChange: (event) => toggleSelection(CURRENT_PAGE_KEY, event.target.checked),
        }),
        h("span", { class: "source-label", text: `This page — ${scan.title}` }),
        h("span", { class: "source-tag", text: "current" }),
    ]);
}
function progressView(progress) {
    const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
    return h("div", { class: "progress" }, [
        h("p", { class: "muted", text: progress.label }),
        h("div", { class: "bar" }, [h("div", { class: "bar-fill", id: "bar-fill" })]),
        progress.total > 0 ? h("p", { class: "muted", text: `${percent}%` }) : null,
    ]);
}
function readyView() {
    const scan = state.scan;
    const configured = state.config !== null && isConfigured(state.config);
    const children = [];
    if (!configured) {
        children.push(h("div", { class: "notice warn" }, [
            h("p", { text: "No LLM endpoint configured yet." }),
            h("button", {
                class: "ghost",
                type: "button",
                text: "Open settings",
                onClick: () => void chrome.runtime.openOptionsPage(),
            }),
        ]));
    }
    if (state.error) {
        children.push(h("div", { class: "notice error" }, [h("p", { text: state.error })]));
    }
    if (scan) {
        children.push(h("h2", { class: "section-label", text: "Sources found on this page" }));
        if (scan.isPolicyPage && scan.pageTextLength > 500)
            children.push(currentRow(scan));
        if (scan.links.length === 0) {
            children.push(h("p", {
                class: "muted",
                text: "No Terms/Privacy links found in the footer. Try opening the policy page directly.",
            }));
        }
        else {
            children.push(...scan.links.map(linkRow));
        }
        children.push(h("button", {
            class: "primary",
            type: "button",
            text: "Explain in plain language",
            disabled: !configured || state.selected.size === 0,
            onClick: () => void runAnalysis(),
        }));
    }
    for (const problem of state.problems) {
        children.push(h("div", { class: "notice warn" }, [h("p", { text: problem })]));
    }
    return children;
}
function doneView() {
    const children = [];
    if (state.reports.length === 0) {
        children.push(h("div", { class: "notice error" }, [
            h("p", { text: "No report could be produced for the selected sources." }),
        ]));
    }
    else {
        children.push(...state.reports.map(renderReportCard));
    }
    for (const problem of state.problems) {
        children.push(h("div", { class: "notice warn" }, [h("p", { text: problem })]));
    }
    children.push(h("button", {
        class: "ghost wide",
        type: "button",
        text: "Analyse again",
        onClick: () => {
            state.phase = "ready";
            state.reports = [];
            render();
        },
    }));
    return children;
}
function render() {
    const container = requireRoot();
    const children = [];
    switch (state.phase) {
        case "boot":
            children.push(h("p", { class: "muted", text: "Scanning page footer…" }));
            break;
        case "unsupported":
            children.push(h("div", { class: "notice warn" }, [
                h("p", { text: "FinePrint only works on http/https pages. Open a website and try again." }),
            ]));
            break;
        case "error":
            children.push(h("div", { class: "notice error" }, [h("p", { text: state.error ?? "Unknown error." })]));
            break;
        case "ready":
            children.push(...readyView());
            break;
        case "running":
            if (state.progress)
                children.push(progressView(state.progress));
            children.push(h("p", { class: "muted", text: "Running the prompt pipeline…" }));
            break;
        case "done":
            children.push(...doneView());
            break;
    }
    replace(container, ...children);
    // The bar width can only be set after the node exists in the DOM.
    const fill = document.getElementById("bar-fill");
    if (fill && state.progress && state.progress.total > 0) {
        fill.style.width = `${Math.round((state.progress.done / state.progress.total) * 100)}%`;
    }
}
document.getElementById("open-options")?.addEventListener("click", () => {
    void chrome.runtime.openOptionsPage();
});
void boot().then(render);
