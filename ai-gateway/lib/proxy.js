import { complete } from "./providers.js";
import { assertBudget, extractUserKey, findUserByKey, MODELS, priceUsd, recordUse, resolveModel } from "./team.js";

export async function handleChatCompletions(req, res) {
  const user = requireUser(req);
  const model = requireModel(req.body?.model);
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
  const user = requireUser(req);
  const model = requireModel(req.body?.model);
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

export function handleModels(_req, res) {
  res.json({
    object: "list",
    data: MODELS.map((item) => ({ id: item.id, object: "model", owned_by: item.provider }))
  });
}

async function run(user, model, messages, maxTokens) {
  assertBudget(user);
  try {
    const result = await complete({
      provider: model.provider,
      modelId: model.id,
      messages,
      maxTokens
    });
    const usd = priceUsd(model.id, result.inputTokens, result.outputTokens);
    recordUse({
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
    recordUse({
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

function requireUser(req) {
  const user = findUserByKey(extractUserKey(req));
  if (!user) {
    throw fail(401, "Mã nội bộ không hợp lệ.");
  }
  return user;
}

function requireModel(name) {
  const model = resolveModel(name);
  if (!model) {
    throw fail(400, `Model không hỗ trợ. Dùng: ${MODELS.map((item) => item.id).join(", ")}`);
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
