import type { OpenAICompatibleConfig } from "@mastra/core/llm";
import { env, hasConfiguredModel } from "../env.js";

/**
 * Mastra accepts `OpenAICompatibleConfig` directly as an agent model, which
 * means NVIDIA NIM (and any other OpenAI-compatible provider) plugs in with
 * zero adapter code — Mastra owns the request/response shape internally.
 */
export function buildModelConfig(): OpenAICompatibleConfig {
  if (env.OPENAI_COMPATIBLE_API_KEY && env.OPENAI_COMPATIBLE_BASE_URL && env.OPENAI_COMPATIBLE_MODEL) {
    return {
      providerId: "openai-compatible",
      modelId: env.OPENAI_COMPATIBLE_MODEL,
      url: env.OPENAI_COMPATIBLE_BASE_URL,
      apiKey: env.OPENAI_COMPATIBLE_API_KEY
    };
  }

  return {
    providerId: "nvidia",
    modelId: env.NVIDIA_MODEL,
    url: env.NVIDIA_BASE_URL,
    apiKey: env.NVIDIA_API_KEY ?? ""
  };
}

export { hasConfiguredModel };
