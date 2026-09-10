import { loadStore, vendorReady } from "./store.js";
import { estimateTokens } from "./team.js";

const ANTHROPIC_MODEL = {
  "claude-sonnet-4-6": "claude-sonnet-4-5"
};

const GEMINI_MODEL = {
  "gemini-2.5-flash": "gemini-2.5-flash"
};

export async function complete({ provider, modelId, messages, maxTokens }) {
  if (provider === "claude") return completeAnthropic(modelId, messages, maxTokens);
  if (provider === "grok") return completeGrok(modelId, messages, maxTokens);
  if (provider === "gemini") return completeGemini(modelId, messages, maxTokens);
  throw fail(400, `Không hỗ trợ nhà ${provider}.`);
}

async function completeAnthropic(modelId, messages, maxTokens) {
  const key = requireVendor("claude");
  const mapped = messagesToAnthropic(messages);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL[modelId] ?? "claude-sonnet-4-5",
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

async function completeGrok(_modelId, messages, maxTokens) {
  const key = requireVendor("grok");
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: "grok-3",
      messages: messagesToOpenAI(messages),
      max_tokens: maxTokens
    })
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw fail(response.status, vendorError("Grok", body));
  }
  const text = body.choices?.[0]?.message?.content ?? "";
  return {
    text,
    inputTokens: body.usage?.prompt_tokens ?? estimateTokens(JSON.stringify(messages)),
    outputTokens: body.usage?.completion_tokens ?? estimateTokens(text)
  };
}

async function completeGemini(modelId, messages, maxTokens) {
  const key = requireVendor("gemini");
  const upstream = GEMINI_MODEL[modelId] ?? "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${upstream}:generateContent?key=${encodeURIComponent(key)}`,
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
    inputTokens: usage.promptTokenCount ?? estimateTokens(JSON.stringify(messages)),
    outputTokens: usage.candidatesTokenCount ?? estimateTokens(text)
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

function requireVendor(name) {
  const key = loadStore().vendorKeys[name];
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
