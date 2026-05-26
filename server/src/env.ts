import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NVIDIA_API_KEY: z.string().optional(),
  NVIDIA_BASE_URL: z.string().url().default("https://integrate.api.nvidia.com/v1"),
  NVIDIA_MODEL: z.string().default("meta/llama-3.1-70b-instruct"),
  OPENAI_COMPATIBLE_API_KEY: z.string().optional(),
  OPENAI_COMPATIBLE_BASE_URL: z.string().url().optional(),
  OPENAI_COMPATIBLE_MODEL: z.string().optional(),
  APP_STORE_LOOKUP_URL: z.string().url().default("https://itunes.apple.com/lookup"),
  APP_STORE_SEARCH_URL: z.string().url().default("https://itunes.apple.com/search")
});

export const env = envSchema.parse(process.env);

export function hasConfiguredModel(): boolean {
  return Boolean(env.NVIDIA_API_KEY || (env.OPENAI_COMPATIBLE_API_KEY && env.OPENAI_COMPATIBLE_BASE_URL));
}
