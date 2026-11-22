/** Options page: LiteLLM / OpenAI-compatible endpoint + key + model (stored locally). */
import { CONFIG_DEFAULTS, loadConfig, saveConfig } from "../shared/config.js";
import { h, replace } from "../sidepanel/ui.js";
const FIELDS = [
    {
        key: "baseUrl",
        label: "LiteLLM base URL",
        hint: "Any OpenAI-compatible endpoint. Examples: your LiteLLM proxy http://localhost:4000/v1, https://api.litellm.ai/v1, https://api.openai.com/v1",
        type: "text",
        placeholder: "http://localhost:4000/v1",
    },
    {
        key: "apiKey",
        label: "API key",
        hint: "Stored only in this browser's extension storage. Never committed to the repository.",
        type: "password",
        placeholder: "sk-…",
    },
    {
        key: "model",
        label: "Model",
        hint: "Whatever your endpoint routes, e.g. gpt-4o-mini, gemini/gemini-2.5-flash, groq/llama-3.1-70b-versatile",
        type: "text",
        placeholder: "gpt-4o-mini",
    },
    {
        key: "temperature",
        label: "Temperature",
        hint: "0.2 keeps the JSON output stable. Allowed range 0–1.",
        type: "number",
        placeholder: "0.2",
    },
];
const inputs = new Map();
let status = null;
function showStatus(message, kind) {
    if (!status)
        return;
    replace(status, h("p", { class: `notice ${kind === "ok" ? "ok" : "error"}`, text: message }));
}
async function init() {
    const form = document.getElementById("options-form");
    const statusHost = document.getElementById("status");
    if (!form || !statusHost)
        throw new Error("Options page markup missing");
    status = statusHost;
    const config = await loadConfig();
    for (const spec of FIELDS) {
        const input = h("input", {
            type: spec.type,
            id: `field-${spec.key}`,
            placeholder: spec.placeholder,
            value: String(config[spec.key]),
        });
        if (spec.type === "number") {
            input.step = "0.1";
            input.min = "0";
            input.max = "1";
        }
        inputs.set(spec.key, input);
        form.append(h("label", { class: "field" }, [
            h("span", { class: "field-label", text: spec.label }),
            input,
            h("span", { class: "field-hint", text: spec.hint }),
        ]));
    }
    form.append(h("div", { class: "actions" }, [
        h("button", { class: "primary", type: "submit", text: "Save settings" }),
        h("button", {
            class: "ghost",
            type: "button",
            text: "Reset",
            onClick: () => {
                for (const spec of FIELDS) {
                    const input = inputs.get(spec.key);
                    if (input)
                        input.value = String(CONFIG_DEFAULTS[spec.key]);
                }
                showStatus("Fields reset (not saved yet).", "ok");
            },
        }),
    ]));
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        void (async () => {
            const baseUrl = inputs.get("baseUrl")?.value ?? "";
            const apiKey = inputs.get("apiKey")?.value ?? "";
            const model = inputs.get("model")?.value ?? "";
            const temperature = Number(inputs.get("temperature")?.value ?? CONFIG_DEFAULTS.temperature);
            if (!baseUrl || !model) {
                showStatus("Base URL and model are required.", "error");
                return;
            }
            await saveConfig({
                baseUrl,
                apiKey,
                model,
                temperature: Number.isFinite(temperature) ? temperature : 0.2,
            });
            showStatus("Saved. The side panel will use these settings.", "ok");
        })();
    });
}
void init();
