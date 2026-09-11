import { complete, generateImage, generateVideo } from "./providers.js";
import { assertBudget, extractUserKey, findUserByKey, MODELS, priceUsd, recordUse, resolveModel } from "./team.js";

export async function handleChatCompletions(req, res) {
  const user = await requireUser(req);
  const model = requireModel(req.body?.model, "chat");
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const maxTokens =
    Number(req.body?.max_tokens || req.body?.max_completion_tokens) > 0
      ? Number(req.body.max_tokens || req.body.max_completion_tokens)
      : 2048;
  const stream = Boolean(req.body?.stream);
  const result = await run(user, model, messages, maxTokens);
  if (stream) {
    startStream(res);
    res.write(
      `data: ${JSON.stringify({
        id: `chatcmpl-${result.id}`,
        object: "chat.completion.chunk",
        choices: [{ index: 0, delta: { role: "assistant", content: result.text } }]
      })}\n\n`
    );
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }
  res.json({
    id: `chatcmpl-${result.id}`,
    object: "chat.completion",
    choices: [{ index: 0, message: { role: "assistant", content: result.text }, finish_reason: "stop" }],
    usage: {
      prompt_tokens: result.inputTokens,
      completion_tokens: result.outputTokens,
      total_tokens: result.inputTokens + result.outputTokens
    }
  });
}

export async function handleMessages(req, res) {
  const user = await requireUser(req);
  const model = requireModel(req.body?.model, "chat");
  const maxTokens = Number(req.body?.max_tokens) > 0 ? Number(req.body.max_tokens) : 2048;
  const messages = [
    ...flattenSystem(req.body?.system),
    ...(Array.isArray(req.body?.messages) ? req.body.messages : [])
  ];
  const stream = Boolean(req.body?.stream);
  const result = await run(user, model, messages, maxTokens);
  if (stream) {
    startStream(res);
    res.write(
      `event: message_start\ndata: ${JSON.stringify({
        type: "message_start",
        message: {
          id: result.id,
          type: "message",
          role: "assistant",
          content: [],
          model: model.id,
          usage: { input_tokens: result.inputTokens, output_tokens: 0 }
        }
      })}\n\n`
    );
    res.write(
      `event: content_block_start\ndata: ${JSON.stringify({
        type: "content_block_start",
        index: 0,
        content_block: { type: "text", text: "" }
      })}\n\n`
    );
    res.write(
      `event: content_block_delta\ndata: ${JSON.stringify({
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: result.text }
      })}\n\n`
    );
    res.write(`event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: 0 })}\n\n`);
    res.write(
      `event: message_delta\ndata: ${JSON.stringify({
        type: "message_delta",
        delta: { stop_reason: "end_turn" },
        usage: { output_tokens: result.outputTokens }
      })}\n\n`
    );
    res.write(`event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`);
    res.end();
    return;
  }
  res.json({
    id: result.id,
    type: "message",
    role: "assistant",
    model: model.id,
    content: [{ type: "text", text: result.text }],
    stop_reason: "end_turn",
    usage: { input_tokens: result.inputTokens, output_tokens: result.outputTokens }
  });
}

export async function handleImageGenerations(req, res) {
  const user = await requireUser(req);
  const model = requireModel(req.body?.model, "image");
  const prompt = String(req.body?.prompt ?? "").trim();
  if (!prompt) {
    throw fail(400, "Thiếu prompt.");
  }
  const result = await runMedia(user, model, () =>
    generateImage({
      provider: model.provider,
      upstream: model.upstream,
      prompt,
      workspaceId: user.workspaceId
    })
  );
  res.json(result.body);
}

export async function handleVideos(req, res) {
  const user = await requireUser(req);
  const model = requireModel(req.body?.model, "video");
  const prompt = String(req.body?.prompt ?? "").trim();
  if (!prompt) {
    throw fail(400, "Thiếu prompt.");
  }
  const result = await runMedia(user, model, () =>
    generateVideo({
      provider: model.provider,
      upstream: model.upstream,
      prompt,
      workspaceId: user.workspaceId
    })
  );
  res.json(result.body);
}

export function handleModels(_req, res) {
  res.json({
    object: "list",
    data: MODELS.map((item) => ({
      id: item.id,
      object: "model",
      owned_by: item.provider,
      kind: item.kind
    }))
  });
}

/** Cline provider Gemini gọi `/v1/models/{id}:streamGenerateContent`, không phải `/v1/chat/completions`. */
export async function handleGeminiGenerate(req, res) {
  const user = await requireUser(req);
  const parsed = parseGeminiModelPath(req.path);
  if (!parsed) {
    throw fail(404, "Đường Gemini không hỗ trợ.");
  }
  const model = requireModel(parsed.model, "chat");
  const messages = geminiContentsToMessages(req.body);
  const maxTokens =
    Number(req.body?.generationConfig?.maxOutputTokens) > 0 ? Number(req.body.generationConfig.maxOutputTokens) : 2048;
  const result = await run(user, model, messages, maxTokens);
  const payload = {
    candidates: [
      {
        content: { role: "model", parts: [{ text: result.text }] },
        finishReason: "STOP"
      }
    ],
    usageMetadata: {
      promptTokenCount: result.inputTokens,
      candidatesTokenCount: result.outputTokens,
      totalTokenCount: result.inputTokens + result.outputTokens
    }
  };
  if (parsed.stream) {
    startStream(res);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    res.end();
    return;
  }
  res.json(payload);
}

function parseGeminiModelPath(path) {
  const match = String(path).match(/^\/v1(?:beta)?\/models\/([^/]+):(streamGenerateContent|generateContent)$/);
  if (!match) return null;
  const model = decodeURIComponent(match[1] ?? "").replace(/^models\//, "");
  return { model, stream: match[2] === "streamGenerateContent" };
}

function geminiContentsToMessages(body) {
  const messages = [];
  const system = body?.systemInstruction;
  const systemText = Array.isArray(system?.parts)
    ? system.parts.map((part) => part?.text ?? "").join("")
    : typeof system === "string"
      ? system
      : "";
  if (systemText.trim()) {
    messages.push({ role: "system", content: systemText });
  }
  for (const item of Array.isArray(body?.contents) ? body.contents : []) {
    const text = Array.isArray(item?.parts) ? item.parts.map((part) => part?.text ?? "").join("") : "";
    messages.push({
      role: item?.role === "model" ? "assistant" : "user",
      content: text
    });
  }
  return messages;
}

async function run(user, model, messages, maxTokens) {
  assertBudget(user);
  try {
    const result = await complete({
      provider: model.provider,
      modelId: model.id,
      upstream: model.upstream,
      messages,
      maxTokens,
      workspaceId: user.workspaceId
    });
    const usd = priceUsd(model, result.inputTokens, result.outputTokens);
    await recordUse({
      user,
      model: model.id,
      provider: model.provider,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      usd,
      ok: true
    });
    return { ...result, id: `msg_${Date.now().toString(16)}` };
  } catch (error) {
    await recordUse({
      user,
      model: model.id,
      provider: model.provider,
      inputTokens: 0,
      outputTokens: 0,
      usd: 0,
      ok: false,
      error: error.message
    });
    throw error;
  }
}

async function runMedia(user, model, generate) {
  assertBudget(user);
  try {
    const result = await generate();
    const usd = priceUsd(model, result.inputTokens, result.outputTokens);
    await recordUse({
      user,
      model: model.id,
      provider: model.provider,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      usd,
      ok: true
    });
    return result;
  } catch (error) {
    await recordUse({
      user,
      model: model.id,
      provider: model.provider,
      inputTokens: 0,
      outputTokens: 0,
      usd: 0,
      ok: false,
      error: error.message
    });
    throw error;
  }
}

async function requireUser(req) {
  const user = await findUserByKey(extractUserKey(req));
  if (!user) {
    throw fail(401, "Mã nội bộ không hợp lệ.");
  }
  return user;
}

function requireModel(name, kind) {
  const model = resolveModel(name);
  const ids = MODELS.filter((item) => !kind || item.kind === kind).map((item) => item.id);
  if (!model) {
    throw fail(400, `Model không hỗ trợ. Dùng: ${ids.join(", ")}`);
  }
  if (kind && model.kind !== kind) {
    throw fail(400, `Model ${model.id} là ${model.kind}, endpoint này cần ${kind}.`);
  }
  return model;
}

function flattenSystem(system) {
  if (!system) return [];
  if (typeof system === "string") return [{ role: "system", content: system }];
  if (Array.isArray(system)) {
    return [{ role: "system", content: system.map((part) => part.text ?? part).join("\n") }];
  }
  return [{ role: "system", content: String(system) }];
}

function startStream(res) {
  res.setHeader("content-type", "text/event-stream; charset=utf-8");
  res.setHeader("cache-control", "no-cache");
  res.setHeader("connection", "keep-alive");
  res.setHeader("x-accel-buffering", "no");
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
