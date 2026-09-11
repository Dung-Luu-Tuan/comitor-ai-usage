import { vendorReady } from "./store.js";
import { estimateTokens, loadVendorKeys } from "./team.js";

const OPENAI_CHAT = {
  openai: { url: "https://api.openai.com/v1/chat/completions", name: "OpenAI" },
  grok: { url: "https://api.x.ai/v1/chat/completions", name: "Grok" },
  deepseek: { url: "https://api.deepseek.com/v1/chat/completions", name: "DeepSeek" },
  mistral: { url: "https://api.mistral.ai/v1/chat/completions", name: "Mistral" }
};

export async function complete({ provider, modelId, upstream, messages, maxTokens, workspaceId }) {
  if (provider === "claude") return completeAnthropic(upstream ?? modelId, messages, maxTokens, workspaceId);
  if (provider === "gemini") return completeGemini(upstream ?? modelId, messages, maxTokens, workspaceId);
  const openai = OPENAI_CHAT[provider];
  if (openai) {
    return completeOpenAICompat(openai, upstream ?? modelId, messages, maxTokens, workspaceId, provider);
  }
  throw fail(400, `Không hỗ trợ chat với nhà ${provider}.`);
}

export async function generateImage({ provider, upstream, prompt, workspaceId }) {
  const key = await requireVendor(workspaceId, provider);
  if (provider === "openai") {
    return postVendorJson(
      "OpenAI",
      "https://api.openai.com/v1/images/generations",
      { authorization: `Bearer ${key}` },
      { model: upstream, prompt, n: 1, size: "1024x1024" },
      prompt
    );
  }
  if (provider === "grok") {
    return postVendorJson(
      "Grok",
      "https://api.x.ai/v1/images/generations",
      { authorization: `Bearer ${key}` },
      { model: upstream, prompt },
      prompt
    );
  }
  if (provider === "gemini") {
    return postVendorJson(
      "Gemini",
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(upstream)}:predict?key=${encodeURIComponent(key)}`,
      {},
      { instances: [{ prompt }], parameters: { sampleCount: 1 } },
      prompt
    );
  }
  if (provider === "flux") {
    return postVendorJson(
      "FLUX",
      `https://api.bfl.ai/v1/${encodeURIComponent(upstream)}`,
      { "x-key": key },
      { prompt },
      prompt
    );
  }
  if (provider === "stability") {
    const form = new FormData();
    form.set("prompt", prompt);
    form.set("output_format", "png");
    const response = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, accept: "application/json" },
      body: form
    });
    return packVendorResponse("Stability", response, prompt);
  }
  if (provider === "ideogram") {
    return postVendorJson(
      "Ideogram",
      "https://api.ideogram.ai/v1/ideogram-v3/generate",
      { "api-key": key },
      { prompt, model: upstream },
      prompt
    );
  }
  throw fail(400, `Không hỗ trợ ảnh với nhà ${provider}.`);
}

export async function generateVideo({ provider, upstream, prompt, workspaceId }) {
  const key = await requireVendor(workspaceId, provider);
  if (provider === "openai") {
    return postVendorJson(
      "OpenAI",
      "https://api.openai.com/v1/videos",
      { authorization: `Bearer ${key}` },
      { model: upstream, prompt },
      prompt
    );
  }
  if (provider === "gemini") {
    return postVendorJson(
      "Gemini",
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(upstream)}:predictLongRunning?key=${encodeURIComponent(key)}`,
      {},
      { instances: [{ prompt }] },
      prompt
    );
  }
  if (provider === "grok") {
    return postVendorJson(
      "Grok",
      "https://api.x.ai/v1/videos/generations",
      { authorization: `Bearer ${key}` },
      { model: upstream, prompt },
      prompt
    );
  }
  if (provider === "runway") {
    return postVendorJson(
      "Runway",
      "https://api.dev.runwayml.com/v1/text_to_video",
      { authorization: `Bearer ${key}`, "X-Runway-Version": "2024-11-06" },
      { model: upstream, promptText: prompt },
      prompt
    );
  }
  if (provider === "kling") {
    return postVendorJson(
      "Kling",
      "https://api.klingai.com/v1/videos/text2video",
      { authorization: `Bearer ${key}` },
      { model_name: upstream, prompt },
      prompt
    );
  }
  if (provider === "luma") {
    return postVendorJson(
      "Luma",
      "https://api.lumalabs.ai/dream-machine/v1/generations",
      { authorization: `Bearer ${key}` },
      { prompt, model: upstream },
      prompt
    );
  }
  if (provider === "seedance") {
    return postVendorJson(
      "Seedance",
      "https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks",
      { authorization: `Bearer ${key}` },
      { model: upstream, content: [{ type: "text", text: prompt }] },
      prompt
    );
  }
  if (provider === "pika") {
    return postVendorJson(
      "Pika",
      "https://api.pika.art/v1/generate",
      { authorization: `Bearer ${key}` },
      { prompt, model: upstream },
      prompt
    );
  }
  if (provider === "hailuo") {
    return postVendorJson(
      "Hailuo",
      "https://api.minimax.io/v1/video_generation",
      { authorization: `Bearer ${key}` },
      { model: upstream, prompt },
      prompt
    );
  }
  throw fail(400, `Không hỗ trợ video với nhà ${provider}.`);
}

async function completeAnthropic(upstream, messages, maxTokens, workspaceId) {
  const key = await requireVendor(workspaceId, "claude");
  const mapped = messagesToAnthropic(messages);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: upstream || "claude-sonnet-4-5",
      max_tokens: maxTokens,
      ...(mapped.system ? { system: mapped.system } : {}),
      messages: mapped.messages
    })
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw fail(response.status, vendorError("Claude", body));
  }
  const text = (body.content ?? []).map((part) => part.text ?? "").join("");
  return {
    text,
    inputTokens: body.usage?.input_tokens ?? estimateTokens(JSON.stringify(messages)),
    outputTokens: body.usage?.output_tokens ?? estimateTokens(text)
  };
}

function geminiBilledTokens(usage, messages, text) {
  const inputTokens = usage.promptTokenCount ?? estimateTokens(JSON.stringify(messages));
  // Google tính thinking vào output. `totalTokenCount - prompt` gồm candidates + thoughts.
  const billedOutput =
    usage.totalTokenCount != null && usage.promptTokenCount != null
      ? Math.max(0, usage.totalTokenCount - usage.promptTokenCount)
      : (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
  const outputTokens = billedOutput > 0 ? billedOutput : estimateTokens(text);
  return { inputTokens, outputTokens };
}

async function completeGemini(upstream, messages, maxTokens, workspaceId) {
  const key = await requireVendor(workspaceId, "gemini");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(upstream)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: messagesToGemini(messages),
        generationConfig: { maxOutputTokens: maxTokens }
      })
    }
  );
  const body = await readJson(response);
  if (!response.ok) {
    throw fail(response.status, vendorError("Gemini", body));
  }
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  const usage = body.usageMetadata ?? {};
  return {
    text,
    ...geminiBilledTokens(usage, messages, text)
  };
}

async function completeOpenAICompat(spec, upstream, messages, maxTokens, workspaceId, provider) {
  const key = await requireVendor(workspaceId, provider);
  const response = await fetch(spec.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: upstream,
      messages: messagesToOpenAI(messages),
      max_tokens: maxTokens
    })
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw fail(response.status, vendorError(spec.name, body));
  }
  const text = body.choices?.[0]?.message?.content ?? "";
  return {
    text,
    inputTokens: body.usage?.prompt_tokens ?? estimateTokens(JSON.stringify(messages)),
    outputTokens: body.usage?.completion_tokens ?? estimateTokens(text)
  };
}

async function postVendorJson(name, url, headers, payload, prompt) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(payload)
  });
  return packVendorResponse(name, response, prompt);
}

async function packVendorResponse(name, response, prompt) {
  const body = await readJson(response);
  if (!response.ok) {
    throw fail(response.status, vendorError(name, body));
  }
  return {
    body,
    inputTokens: estimateTokens(prompt),
    outputTokens: 0
  };
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

async function requireVendor(workspaceId, name) {
  const keys = await loadVendorKeys(workspaceId);
  const key = keys[name];
  if (!vendorReady(key)) {
    throw fail(503, `Chưa có key ${name} trên web admin. Hỏi AI sẽ chạy khi admin dán key.`);
  }
  return key;
}

function messagesToOpenAI(messages) {
  return messages.map((item) => ({
    role: item.role === "assistant" ? "assistant" : item.role === "system" ? "system" : "user",
    content: contentText(item.content)
  }));
}

function messagesToAnthropic(messages) {
  const system = messages
    .filter((item) => item.role === "system")
    .map((item) => contentText(item.content))
    .join("\n");
  const rest = mergeRoles(
    messages
      .filter((item) => item.role !== "system")
      .map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: contentText(item.content)
      }))
  );
  if (rest.length === 0 || rest[0].role !== "user") {
    rest.unshift({ role: "user", content: "(empty)" });
  }
  return { system: system || undefined, messages: rest };
}

function messagesToGemini(messages) {
  const system = messages
    .filter((item) => item.role === "system")
    .map((item) => contentText(item.content))
    .join("\n");
  const rest = messages
    .filter((item) => item.role !== "system")
    .map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: contentText(item.content) }]
    }));
  if (system) {
    const firstUser = rest.find((item) => item.role === "user");
    if (firstUser) {
      firstUser.parts[0].text = `${system}\n\n${firstUser.parts[0].text}`;
    } else {
      rest.unshift({ role: "user", parts: [{ text: system }] });
    }
  }
  if (rest.length === 0) {
    rest.push({ role: "user", parts: [{ text: "(empty)" }] });
  }
  return rest;
}

function mergeRoles(messages) {
  const out = [];
  for (const item of messages) {
    const last = out[out.length - 1];
    if (last && last.role === item.role) {
      last.content = `${last.content}\n${item.content}`;
    } else {
      out.push({ ...item });
    }
  }
  return out;
}

function contentText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.text) return part.text;
        if (part?.type === "text") return part.text ?? "";
        return "";
      })
      .join("");
  }
  return JSON.stringify(content ?? "");
}

function vendorError(name, body) {
  return body?.error?.message || body?.message || JSON.stringify(body) || `${name} từ chối request.`;
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
