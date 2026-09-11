import { describe, expect, it } from "vitest";
import {
  catalogKindFromMode,
  displayRate,
  findLitellmEntry,
  LITELLM_LONG_CONTEXT_TOKENS,
  type LitellmPriceMap,
  litellmCandidateNames,
  priceUsage,
  roundUsd,
  tokenUsdPerMillion,
  vendorModelRates
} from "./model-price";

const MAP: LitellmPriceMap = {
  "gpt-4o": {
    input_cost_per_token: 0.0000025,
    output_cost_per_token: 0.00001
  },
  "xai/grok-4.6": {
    input_cost_per_token: 0.000002,
    output_cost_per_token: 0.000006,
    input_cost_per_token_above_200k_tokens: 0.000004,
    output_cost_per_token_above_200k_tokens: 0.000012
  },
  "deepseek-v4-flash": {
    input_cost_per_token: 0.00000015,
    output_cost_per_token: 0.0000006
  },
  "xai/grok-imagine-image": {
    input_cost_per_image: 0.02
  },
  "sora-2": {
    output_cost_per_video_per_second: 0.1
  },
  "gpt-image-1": {
    input_cost_per_token: 0.000005
  }
};

describe("litellmCandidateNames", () => {
  it("thu id, upstream, tien to hang, roi alias catalog", () => {
    expect(
      litellmCandidateNames({
        id: "claude-sonnet-4-6",
        provider: "claude",
        upstream: "claude-sonnet-4-5",
        aliases: ["claude-sonnet-4-6"]
      })
    ).toEqual(["claude-sonnet-4-6", "claude-sonnet-4-5", "anthropic/claude-sonnet-4-6", "anthropic/claude-sonnet-4-5"]);
  });

  it("deepseek-flash tro toi key LiteLLM v4-flash", () => {
    const names = litellmCandidateNames({ id: "deepseek-flash", provider: "deepseek", upstream: "deepseek-flash" });
    expect(names[0]).toBe("deepseek-v4-flash");
    expect(names).toContain("deepseek/deepseek-v4-flash");
    expect(names).toContain("deepseek/deepseek-flash");
  });
});

describe("findLitellmEntry", () => {
  it("lay phan tu dau tien co trong map", () => {
    const found = findLitellmEntry(MAP, ["missing", "xai/grok-4.6", "gpt-4o"]);
    expect(found?.key).toBe("xai/grok-4.6");
  });

  it("null khi khong khoa nao khop", () => {
    expect(findLitellmEntry(MAP, ["nope"])).toBeNull();
  });
});

describe("priceUsage", () => {
  it("chat ngan: token * gia / token", () => {
    expect(
      priceUsage(MAP, {
        names: ["gpt-4o"],
        kind: "chat",
        inputTokens: 1_000_000,
        outputTokens: 1_000_000
      })
    ).toBe(12.5);
  });

  it("ngu canh dai dung gia above 200k cho MOI token", () => {
    expect(
      priceUsage(MAP, {
        names: ["xai/grok-4.6"],
        kind: "chat",
        inputTokens: LITELLM_LONG_CONTEXT_TOKENS,
        outputTokens: 1_000
      })
    ).toBe(roundUsd(200_000 * 0.000004 + 1_000 * 0.000012));
  });

  it("id la khong co gia", () => {
    expect(priceUsage(MAP, { names: ["mystery"], kind: "chat", inputTokens: 10, outputTokens: 10 })).toBeNull();
  });

  it("anh theo don gia / anh", () => {
    expect(
      priceUsage(MAP, {
        names: ["xai/grok-imagine-image"],
        kind: "image",
        inputTokens: 0,
        outputTokens: 0,
        imageCount: 2
      })
    ).toBe(0.04);
  });

  it("anh chi co gia token thi nhan token", () => {
    expect(
      priceUsage(MAP, {
        names: ["gpt-image-1"],
        kind: "image",
        inputTokens: 1_000,
        outputTokens: 0
      })
    ).toBe(0.005);
  });

  it("video can giay; thieu thi null", () => {
    expect(priceUsage(MAP, { names: ["sora-2"], kind: "video", inputTokens: 0, outputTokens: 0 })).toBeNull();
    expect(
      priceUsage(MAP, {
        names: ["sora-2"],
        kind: "video",
        inputTokens: 0,
        outputTokens: 0,
        videoSeconds: 5
      })
    ).toBe(0.5);
  });

  it("anh count khong hop le thi null", () => {
    expect(
      priceUsage(MAP, {
        names: ["xai/grok-imagine-image"],
        kind: "image",
        inputTokens: 0,
        outputTokens: 0,
        imageCount: 0
      })
    ).toBeNull();
  });

  it("chat 200k ma khong co gia dai thi van dung gia ngan", () => {
    expect(
      priceUsage(MAP, {
        names: ["gpt-4o"],
        kind: "chat",
        inputTokens: LITELLM_LONG_CONTEXT_TOKENS,
        outputTokens: 0
      })
    ).toBe(0.5);
  });

  it("alias deepseek-flash ra gia v4-flash", () => {
    const names = litellmCandidateNames({ id: "deepseek-flash", provider: "deepseek" });
    expect(priceUsage(MAP, { names, kind: "chat", inputTokens: 1_000_000, outputTokens: 0 })).toBe(0.15);
  });
});

describe("displayRate", () => {
  it("chat quy doi USD / 1 trieu token", () => {
    expect(displayRate(MAP["gpt-4o"] ?? null, "chat")).toEqual({ kind: "chat", in: 2.5, out: 10 });
  });

  it("anh phang", () => {
    expect(displayRate(MAP["xai/grok-imagine-image"] ?? null, "image")).toEqual({
      kind: "image",
      flatUsd: 0.02
    });
  });

  it("video / giay", () => {
    expect(displayRate(MAP["sora-2"] ?? null, "video")).toEqual({ kind: "video", perSecondUsd: 0.1 });
  });

  it("anh chi co gia token hien in/out", () => {
    expect(displayRate(MAP["gpt-image-1"] ?? null, "image")).toEqual({ kind: "image", in: 5, out: 0 });
  });

  it("video khong co /giay la unknown", () => {
    expect(displayRate(MAP["gpt-4o"] ?? null, "video")).toEqual({ kind: "unknown" });
  });

  it("chat thieu gia vao la unknown", () => {
    expect(displayRate({ output_cost_per_token: 0.00001 }, "chat")).toEqual({ kind: "unknown" });
  });

  it("anh khong co don gia la unknown", () => {
    expect(displayRate({ mode: "image_generation" }, "image")).toEqual({ kind: "unknown" });
  });
});

describe("tokenUsdPerMillion", () => {
  it("2.5e-6 thanh 2.5", () => {
    expect(tokenUsdPerMillion(0.0000025)).toBe(2.5);
  });
});

describe("catalogKindFromMode", () => {
  it("chat/anh/video; bo embedding", () => {
    expect(catalogKindFromMode("chat")).toBe("chat");
    expect(catalogKindFromMode("image_generation")).toBe("image");
    expect(catalogKindFromMode("video_generation")).toBe("video");
    expect(catalogKindFromMode("embedding")).toBeNull();
  });
});

describe("vendorModelRates", () => {
  const geminiMap: LitellmPriceMap = {
    "gemini/gemini-2.5-flash": {
      litellm_provider: "gemini",
      mode: "chat",
      input_cost_per_token: 0.00000015,
      output_cost_per_token: 0.0000006
    },
    "gemini-2.5-flash": {
      litellm_provider: "gemini",
      mode: "chat",
      input_cost_per_token: 0.00000015,
      output_cost_per_token: 0.0000006
    },
    "gemini/gemini-embedding-001": {
      litellm_provider: "gemini",
      mode: "embedding",
      input_cost_per_token: 0.0000001
    },
    "gpt-4o": {
      litellm_provider: "openai",
      mode: "chat",
      input_cost_per_token: 0.0000025,
      output_cost_per_token: 0.00001
    }
  };

  it("chi lay hang gemini, bo embedding, gop prefix trung", () => {
    const rows = vendorModelRates(geminiMap, "gemini", ["gemini-2.5-flash"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "gemini-2.5-flash", kind: "chat", in: 0.15 });
  });

  it("hang khong map thi rong", () => {
    expect(vendorModelRates(geminiMap, "kling")).toEqual([]);
  });

  it("preferred dung truoc, con lai theo abc; anh/video co don gia", () => {
    const map: LitellmPriceMap = {
      "gemini-zeta": {
        litellm_provider: "gemini",
        mode: "chat",
        input_cost_per_token: 0.000001,
        output_cost_per_token: 0.000002
      },
      "gemini-alpha": {
        litellm_provider: "gemini",
        mode: "chat",
        input_cost_per_token: 0.000001,
        output_cost_per_token: 0.000002
      },
      "gemini-preferred": {
        litellm_provider: "gemini",
        mode: "chat",
        input_cost_per_token: 0.000003,
        output_cost_per_token: 0.000004
      },
      "gemini-imagen": {
        litellm_provider: "gemini",
        mode: "image_generation",
        output_cost_per_image: 0.04
      },
      "gemini-token-image": {
        litellm_provider: "gemini",
        mode: "image_generation",
        input_cost_per_token: 0.000002,
        output_cost_per_token: 0.000008
      },
      "gemini-veo": {
        litellm_provider: "gemini",
        mode: "video_generation",
        output_cost_per_video_per_second: 0.35
      }
    };
    const ids = vendorModelRates(map, "gemini", ["gemini-preferred", "gemini-zeta"]).map((row) => row.id);
    expect(ids).toEqual([
      "gemini-preferred",
      "gemini-zeta",
      "gemini-alpha",
      "gemini-imagen",
      "gemini-token-image",
      "gemini-veo"
    ]);
    const imagen = vendorModelRates(map, "gemini").find((row) => row.id === "gemini-imagen");
    const tokenImage = vendorModelRates(map, "gemini").find((row) => row.id === "gemini-token-image");
    const veo = vendorModelRates(map, "gemini").find((row) => row.id === "gemini-veo");
    expect(imagen).toMatchObject({ kind: "image", flatUsd: 0.04 });
    expect(tokenImage).toMatchObject({ kind: "image", in: 2, out: 8 });
    expect(veo).toMatchObject({ kind: "video", perSecondUsd: 0.35 });
  });
});
