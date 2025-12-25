import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Generate unique session ID
export function getSessionId(): string {
  if (typeof window === "undefined") return "";

  let sessionId = sessionStorage.getItem("chat_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("chat_session_id", sessionId);
  }
  return sessionId;
}

// Chat API
export async function sendMessage(message: string, useRag = true) {
  const sessionId = getSessionId();

  const { data, error } = await supabase.functions.invoke("chat", {
    body: { message, session_id: sessionId, use_rag: useRag },
  });

  if (error) throw error;
  return data;
}

// Email signup API
export async function submitEmailSignup(email: string) {
  const { data, error } = await supabase.functions.invoke("email-signup", {
    body: { email },
  });

  if (error) throw error;
  return data;
}

// Health check (just check if supabase is reachable)
export async function healthCheck() {
  try {
    const { error } = await supabase.from("persona").select("id").limit(1);
    return { status: error ? "degraded" : "healthy" };
  } catch {
    return { status: "unhealthy" };
  }
}
