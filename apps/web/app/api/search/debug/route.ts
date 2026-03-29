import { NextRequest, NextResponse } from "next/server";

import { createApiClient } from "@/lib/supabase/api";

/**
 * GET /api/search/debug — check if AI search is properly configured.
 * Returns diagnostic info (no sensitive data exposed).
 */
export async function GET(request: NextRequest) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const hasKey = !!apiKey;
  const keyPrefix = apiKey ? apiKey.slice(0, 10) + "..." : null;

  // Test the Anthropic API with a minimal request
  let apiStatus = "not_tested";
  let apiError: string | null = null;

  if (hasKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 10,
          messages: [{ role: "user", content: "Say hi" }],
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        apiStatus = "ok";
      } else {
        const body = await res.text();
        apiStatus = `error_${res.status}`;
        apiError = body.slice(0, 200);
      }
    } catch (err) {
      apiStatus = "network_error";
      apiError = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json({
    data: {
      hasKey,
      keyPrefix,
      apiStatus,
      apiError,
      env: process.env.NODE_ENV,
    },
  });
}
