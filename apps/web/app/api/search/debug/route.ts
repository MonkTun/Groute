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

  const apiKey = process.env.GEMINI_API_KEY;
  const hasKey = !!apiKey;
  const keyPrefix = apiKey ? apiKey.slice(0, 10) + "..." : null;

  // Test the Gemini API with a minimal request
  let apiStatus = "not_tested";
  let apiError: string | null = null;

  if (hasKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Say hi" }] }],
            generationConfig: { maxOutputTokens: 10 },
          }),
          signal: AbortSignal.timeout(10_000),
        }
      );

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
