/**
 * AI provider abstraction for search.
 *
 * Switch providers by setting AI_PROVIDER env var to "anthropic" or "gemini".
 * Defaults to "anthropic" (Claude Haiku).
 *
 * Required env vars per provider:
 *   anthropic → ANTHROPIC_API_KEY
 *   gemini    → GEMINI_API_KEY
 */

type Provider = "anthropic" | "gemini";

interface AIResponse {
  text: string;
}

function getProvider(): Provider {
  const env = process.env.AI_PROVIDER?.toLowerCase();
  if (env === "gemini") return "gemini";
  return "anthropic";
}

export function getAIConfig(): {
  provider: Provider;
  hasKey: boolean;
  keyPrefix: string | null;
} {
  const provider = getProvider();
  const key =
    provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : process.env.GEMINI_API_KEY;
  return {
    provider,
    hasKey: !!key,
    keyPrefix: key ? key.slice(0, 10) + "..." : null,
  };
}

async function callAnthropic(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<AIResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new AIError(response.status, errBody);
  }

  const data = await response.json();
  return { text: data.content?.[0]?.text ?? "" };
}

async function callGemini(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<AIResponse> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new AIError(response.status, errBody);
  }

  const data = await response.json();
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
  };
}

export class AIError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super(`AI API error ${status}: ${body.slice(0, 200)}`);
  }
}

export async function callAI(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 512
): Promise<AIResponse> {
  const provider = getProvider();
  const config = getAIConfig();

  if (!config.hasKey) {
    throw new Error(`${provider.toUpperCase()} API key is not set`);
  }

  console.log(`[AI] provider=${provider} key=${config.keyPrefix}`);

  if (provider === "gemini") {
    return callGemini(systemPrompt, userMessage, maxTokens);
  }
  return callAnthropic(systemPrompt, userMessage, maxTokens);
}
