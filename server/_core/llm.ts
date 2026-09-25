import { ENV } from "./env";

export type LLMMessage = { role: "system" | "user" | "assistant"; content: string };

export type LLMOutputSchema = {
  name: string;
  strict?: boolean;
  schema: Record<string, unknown>;
};

export type LLMInvocation = {
  model?: string;
  messages: LLMMessage[];
  maxTokens?: number;
  outputSchema?: LLMOutputSchema;
};

export type LLMResult = {
  choices: Array<{ message: { content: string | null } }>;
};

/**
 * Calls an OpenAI-compatible chat completions endpoint. Configure with
 * LLM_API_KEY (required) and LLM_API_URL (defaults to https://api.openai.com/v1).
 * Structured output is requested through response_format when an outputSchema
 * is supplied; callers must still validate the returned JSON themselves.
 */
export async function invokeLLM(invocation: LLMInvocation): Promise<LLMResult> {
  const apiKey = ENV.llmApiKey;
  if (!apiKey) {
    throw new Error(
      "LLM_API_KEY is not configured; set it in the environment to enable AI features",
    );
  }

  const baseUrl = (ENV.llmBaseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: invocation.model ?? "gpt-4o-mini",
      max_completion_tokens: invocation.maxTokens,
      messages: invocation.messages,
      ...(invocation.outputSchema
        ? {
            response_format: {
              type: "json_schema",
              json_schema: {
                name: invocation.outputSchema.name,
                strict: invocation.outputSchema.strict ?? true,
                schema: invocation.outputSchema.schema,
              },
            },
          }
        : {}),
    }),
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => response.statusText)).slice(0, 300);
    throw new Error(`LLM request failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as LLMResult;
}
