"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { sendMessage, healthCheck } from "@/lib/supabase";
import { VoiceInput } from "./VoiceInput";
import { clsx } from "clsx";

export function SubtitleChat() {
  const [inputText, setInputText] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const {
    messages,
    addMessage,
    status,
    setStatus,
    setBlendshapes,
    setIsPlaying,
    isConnected,
  } = useAppStore();

  // Typewriter effect for subtitle
  useEffect(() => {
    if (!subtitle || isTyping) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant") {
      setIsTyping(true);
      let index = 0;
      const text = lastMessage.content;
      setSubtitle("");

      const interval = setInterval(() => {
        if (index < text.length) {
          setSubtitle(text.slice(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
          setIsTyping(false);
        }
      }, 30);

      return () => clearInterval(interval);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || status !== "idle") return;

    const userMessage = inputText.trim();
    setInputText("");
    setSubtitle("");

    addMessage({ role: "user", content: userMessage });
    setStatus("processing");

    try {
      setStatus("thinking");
      const response = await sendMessage(userMessage, true);

      addMessage({ role: "assistant", content: response.text });
      setSubtitle(response.text);

      if (response.audio_base64) {
        setStatus("speaking");
        await playAudio(response.audio_base64);
      }

      setStatus("idle");
    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg = "죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.";
      addMessage({ role: "assistant", content: errorMsg });
      setSubtitle(errorMsg);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  };

  const handleVoiceResult = (text: string) => {
    if (text.trim()) {
      setInputText("");
      addMessage({ role: "user", content: text });
      handleSendMessage(text);
    }
  };

  const handleSendMessage = async (text: string) => {
    setSubtitle("");
    setStatus("processing");

    try {
      setStatus("thinking");
      const response = await sendMessage(text, true);

      addMessage({ role: "assistant", content: response.text });
      setSubtitle(response.text);

      if (response.audio_base64) {
        setStatus("speaking");
        await playAudio(response.audio_base64);
      }

      setStatus("idle");
    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg = "죄송합니다. 오류가 발생했습니다.";
      addMessage({ role: "assistant", content: errorMsg });
      setSubtitle(errorMsg);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  };

  const playAudio = async (audioBase64: string): Promise<void> => {
    return new Promise((resolve) => {
      setIsPlaying(true);
      const audioData = atob(audioBase64);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }
      const blob = new Blob([audioArray], { type: "audio/mp3" });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.play().catch(() => {
        setIsPlaying(false);
        resolve();
      });
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Subtitle Display */}
      <div className="min-h-[60px] flex items-center justify-center">
        {subtitle ? (
          <p className="text-lg text-center text-white bg-black/60 px-6 py-3 rounded-lg">
            {subtitle}
          </p>
        ) : (
          <p className="text-gray-500 text-center">
            {status === "thinking" ? "생각 중..." :
             status === "speaking" ? "말하는 중..." :
             "Chloe에게 말해보세요"}
          </p>
        )}
      </div>

      {/* Input Area */}
      <div className="flex gap-2">
        <VoiceInput onResult={handleVoiceResult} disabled={status !== "idle"} />

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isConnected ? "메시지를 입력하세요..." : "서버에 연결되지 않음"}
          disabled={status !== "idle" || !isConnected}
          className={clsx(
            "flex-1 bg-gray-700 rounded-lg px-4 py-3",
            "focus:outline-none focus:ring-2 focus:ring-primary-500",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "placeholder-gray-400"
          )}
        />

        <button
          onClick={handleSend}
          disabled={!inputText.trim() || status !== "idle" || !isConnected}
          className={clsx(
            "px-6 py-3 bg-primary-600 rounded-lg font-medium",
            "hover:bg-primary-700 transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          전송
        </button>
      </div>
    </div>
  );
}
