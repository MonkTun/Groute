import { NextRequest, NextResponse } from "next/server";

import { createApiClient } from "@/lib/supabase/api";
import { callAI, getAIConfig } from "@/lib/ai";

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

  const { provider, hasKey, keyPrefix } = getAIConfig();

  let apiStatus = "not_tested";
  let apiError: string | null = null;

  if (hasKey) {
    try {
      await callAI("You are a test.", "Say hi", 10);
      apiStatus = "ok";
    } catch (err) {
      apiStatus = "error";
      apiError =
        err instanceof Error ? err.message.slice(0, 200) : String(err);
    }
  }

  return NextResponse.json({
    data: {
      provider,
      hasKey,
      keyPrefix,
      apiStatus,
      apiError,
      env: process.env.NODE_ENV,
    },
  });
}
