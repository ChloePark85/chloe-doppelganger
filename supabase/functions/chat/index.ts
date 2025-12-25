import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, session_id, use_rag = true } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get conversation history
    const { data: history } = await supabase
      .from("conversations")
      .select("role, content")
      .eq("session_id", session_id)
      .order("created_at", { ascending: true })
      .limit(20);

    // Get persona
    const { data: persona } = await supabase
      .from("persona")
      .select("*")
      .single();

    // Get relevant facts
    const { data: facts } = await supabase
      .from("facts")
      .select("category, key, value");

    // RAG: Search similar documents
    let context = "";
    if (use_rag) {
      const embeddingRes = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-ada-002",
          input: message,
        }),
      });
      const embeddingData = await embeddingRes.json();
      const embedding = embeddingData.data?.[0]?.embedding;

      if (embedding) {
        const { data: docs } = await supabase.rpc("match_documents", {
          query_embedding: embedding,
          match_threshold: 0.7,
          match_count: 3,
        });

        if (docs?.length) {
          context = docs.map((d: any) => d.content).join("\n\n");
        }
      }
    }

    // Check if user is asking about availability/schedule
    let calendarContext = "";
    const scheduleKeywords = [
      "일정", "시간", "가능", "언제", "약속", "커피챗", "미팅", "만남",
      "토요일", "일요일", "월요일", "화요일", "수요일", "목요일", "금요일",
      "오전", "오후", "주말", "내일", "오늘", "모레", "이번주", "다음주",
      "몇시", "몇 시", "schedule", "available", "meet"
    ];
    const isAskingAboutSchedule = scheduleKeywords.some(keyword => message.toLowerCase().includes(keyword));

    console.log(`Message: "${message}", isAskingAboutSchedule: ${isAskingAboutSchedule}`);

    if (isAskingAboutSchedule) {
      calendarContext = await getCalendarAvailability();
      console.log(`Calendar context: ${calendarContext.substring(0, 200)}...`);
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(persona, facts, context, calendarContext);

    // Build messages
    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((h: any) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    // Call OpenAI
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    const openaiData = await openaiRes.json();
    const assistantMessage = openaiData.choices?.[0]?.message?.content || "죄송합니다. 응답을 생성할 수 없습니다.";

    // Save messages to DB
    await supabase.from("conversations").insert([
      { session_id, role: "user", content: message },
      { session_id, role: "assistant", content: assistantMessage },
    ]);

    // Generate TTS with ElevenLabs
    let audio_base64 = null;
    const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY");
    const voiceId = Deno.env.get("ELEVENLABS_VOICE_ID") || "ShmDBuwhMPK2bJjWMQmg";

    console.log(`Using ElevenLabs voice ID: ${voiceId}`);

    if (elevenLabsKey) {
      try {
        const ttsRes = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          {
            method: "POST",
            headers: {
              "xi-api-key": elevenLabsKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: assistantMessage,
              model_id: "eleven_v3", // ElevenLabs v3 (alpha) - most expressive
              output_format: "mp3_44100_128",
            }),
          }
        );

        if (ttsRes.ok) {
          const audioBuffer = await ttsRes.arrayBuffer();
          // Use Deno's base64 encoding to avoid stack overflow
          audio_base64 = base64Encode(new Uint8Array(audioBuffer));
        } else {
          console.error("TTS error:", await ttsRes.text());
        }
      } catch (ttsError) {
        console.error("TTS error:", ttsError);
      }
    }

    return new Response(
      JSON.stringify({
        text: assistantMessage,
        audio_base64,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Get calendar availability from Google Calendar
async function getCalendarAvailability(): Promise<string> {
  const googleRefreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";

  if (!googleRefreshToken || !googleClientId || !googleClientSecret) {
    console.log("Google Calendar credentials not configured");
    return "";
  }

  try {
    // Get access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: googleRefreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error("Failed to get access token:", tokenData);
      return "";
    }

    // Get events for next 2 weeks
    const now = new Date();
    const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const eventsRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      new URLSearchParams({
        timeMin: now.toISOString(),
        timeMax: twoWeeksLater.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
      }),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const eventsData = await eventsRes.json();

    if (eventsData.error) {
      console.error("Calendar API error:", eventsData.error);
      return "";
    }

    const events = eventsData.items || [];
    console.log(`Found ${events.length} calendar events`);

    // Build calendar context
    const busyTimes: string[] = [];
    const today = new Date();
    console.log(`Current date/time: ${today.toISOString()}`);

    events.forEach((event: any) => {
      const start = event.start?.dateTime || event.start?.date;
      const end = event.end?.dateTime || event.end?.date;
      console.log(`Event: "${event.summary}" from ${start} to ${end}`);

      if (start && end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const dayOfWeek = ["일", "월", "화", "수", "목", "금", "토"][startDate.getDay()];
        const dateStr = `${startDate.getMonth() + 1}/${startDate.getDate()}(${dayOfWeek})`;
        const timeStr = event.start?.dateTime
          ? `${startDate.getHours()}:${String(startDate.getMinutes()).padStart(2, '0')}-${endDate.getHours()}:${String(endDate.getMinutes()).padStart(2, '0')}`
          : "종일";
        busyTimes.push(`- ${dateStr} ${timeStr}: ${event.summary || "일정 있음"}`);
      }
    });

    if (busyTimes.length === 0) {
      return "\n\n[캘린더 정보]\n앞으로 2주간 등록된 일정이 없습니다. 원하시는 시간에 커피챗 가능합니다.";
    }

    return `\n\n[캘린더 정보 - 이미 잡힌 일정]\n${busyTimes.join("\n")}\n\n위 시간대를 제외한 시간에 커피챗이 가능합니다. 평일 오전 10시-오후 6시 사이를 추천합니다.`;
  } catch (error) {
    console.error("Calendar error:", error);
    return "";
  }
}

function buildSystemPrompt(persona: any, facts: any[], context: string, calendarContext: string): string {
  const name = persona?.name || "Chloe";
  const description = persona?.description || "";
  const tone = persona?.personality?.tone || "friendly";
  const honorific = persona?.communication?.honorific || "polite";

  let prompt = `당신은 ${name}입니다. ${description}

성격: ${tone}
말투: ${honorific === "polite" ? "존댓말" : honorific === "formal" ? "높임말" : "반말"}

`;

  if (facts?.length) {
    prompt += "알고 있는 정보:\n";
    facts.forEach((f: any) => {
      prompt += `- ${f.key}: ${f.value}\n`;
    });
    prompt += "\n";
  }

  if (context) {
    prompt += `관련 지식:\n${context}\n\n`;
  }

  if (calendarContext) {
    prompt += calendarContext;
    prompt += `

중요: 위 캘린더 정보를 반드시 확인하세요!
- 캘린더에 일정이 있는 시간대는 절대로 가능하다고 말하지 마세요.
- 사용자가 특정 날짜/시간을 물으면, 캘린더 정보와 대조하여 정확히 답변하세요.
- 불가능한 시간이면 "그 시간은 다른 일정이 있어서 어려워요"라고 답하고 다른 시간을 제안하세요.`;
  }

  prompt += `

커피챗 요청 시:
- 온라인 미팅은 즉시 Google Meet 링크를 생성해서 제공합니다.
- 오프라인 미팅은 장소와 시간을 확인한 후 승인 절차가 필요하다고 안내합니다.

자연스럽고 친근하게 대화하세요. 답변은 간결하게 2-3문장으로 하세요.`;

  return prompt;
}
