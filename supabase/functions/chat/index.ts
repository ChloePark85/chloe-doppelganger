import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      // Get embedding for the query
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

    // Build system prompt
    const systemPrompt = buildSystemPrompt(persona, facts, context);

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

    // Generate TTS
    let audio_base64 = null;
    const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY");
    const voiceId = Deno.env.get("ELEVENLABS_VOICE_ID") || "21m00Tcm4TlvDq8ikWAM";

    if (elevenLabsKey) {
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
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      if (ttsRes.ok) {
        const audioBuffer = await ttsRes.arrayBuffer();
        audio_base64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
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

function buildSystemPrompt(persona: any, facts: any[], context: string): string {
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

  prompt += `사용자가 커피챗을 원하면 일정을 잡아주세요. 자연스럽고 친근하게 대화하세요.`;

  return prompt;
}
