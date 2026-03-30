import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabaseAdmin;
}

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: "default" | null;
}

/**
 * Send push notifications to a user by looking up their registered push tokens.
 * Uses Expo Push API (https://exp.host/--/api/v2/push/send).
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const { data: tokens, error } = await getSupabaseAdmin()
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId);

  if (error || !tokens || tokens.length === 0) {
    return; // User has no registered devices — silently skip
  }

  const messages: PushMessage[] = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    data,
    sound: "default",
  }));

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error(
        "Expo push API error:",
        response.status,
        await response.text()
      );
    }
  } catch (err) {
    console.error("Failed to send push notification:", err);
  }
}
