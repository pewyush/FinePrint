/**
 * Single client for any LiteLLM / OpenAI-compatible endpoint:
 * POST {baseUrl}/chat/completions  with an Authorization header.
 * The user supplies base URL, key and model on the options page.
 */
export class LlmError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.name = "LlmError";
        this.status = status;
    }
}
function joinUrl(baseUrl) {
    const trimmed = baseUrl.trim().replace(/\/+$/, "");
    return `${trimmed}/chat/completions`;
}
/** Groq-style rate-limit bodies say "try again in 12.34s" — honour that hint. */
function retryDelayMs(body, attempt) {
    const match = body.match(/try again in ([\d.]+)s/);
    if (match?.[1]) {
        const seconds = Number(match[1]);
        if (Number.isFinite(seconds) && seconds > 0)
            return Math.ceil(seconds * 1000) + 500;
    }
    return Math.min(30_000, 5_000 * 2 ** (attempt - 1));
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export function isConfigured(config) {
    return (config.baseUrl.trim().length > 0 &&
        config.apiKey.trim().length > 0 &&
        config.model.trim().length > 0);
}
function configurationProblem(config) {
    if (config.baseUrl.trim().length === 0)
        return "LiteLLM base URL is empty.";
    if (config.apiKey.trim().length === 0)
        return "API key is empty.";
    if (config.model.trim().length === 0)
        return "Model name is empty.";
    return null;
}
/** One chat-completions call with backoff on rate limits / transient errors. Throws LlmError. */
export async function chatCompletion(config, messages, options = {}) {
    const problem = configurationProblem(config);
    if (problem !== null)
        throw new LlmError(`LLM not configured: ${problem}`);
    const maxAttempts = options.maxAttempts ?? 4;
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            return await attemptChat(config, messages, options);
        }
        catch (error) {
            if (!(error instanceof LlmError))
                throw error;
            lastError = error;
            const retriable = error.status === 429 || error.status === 408 || (error.status ?? 0) >= 500;
            if (!retriable || attempt === maxAttempts)
                throw error;
            await sleep(retryDelayMs(error.message, attempt));
        }
    }
    throw lastError ?? new LlmError("LLM request failed.");
}
async function attemptChat(config, messages, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);
    const body = {
        model: config.model.trim(),
        messages,
        temperature: config.temperature,
    };
    if (options.maxTokens !== undefined)
        body.max_tokens = options.maxTokens;
    let response;
    try {
        response = await fetch(joinUrl(config.baseUrl), {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${config.apiKey.trim()}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
    }
    catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw new LlmError("LLM request timed out.");
        }
        const detail = error instanceof Error ? error.message : String(error);
        throw new LlmError(`LLM request failed: ${detail}`);
    }
    finally {
        clearTimeout(timeout);
    }
    if (!response.ok) {
        const detail = (await response.text()).slice(0, 400);
        throw new LlmError(`LLM returned HTTP ${response.status}: ${detail}`, response.status);
    }
    const payload = (await response.json());
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
        throw new LlmError("LLM response contained no message content.");
    }
    return content;
}
