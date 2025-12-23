"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { apiClient } from "@/lib/api";
import { VoiceInput } from "./VoiceInput";
import { clsx } from "clsx";

export function ChatPanel() {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    addMessage,
    status,
    setStatus,
    setBlendshapes,
    setIsPlaying,
    isConnected,
  } = useAppStore();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || status !== "idle") return;

    const userMessage = inputText.trim();
    setInputText("");

    // Add user message
    addMessage({ role: "user", content: userMessage });
    setStatus("processing");

    try {
      // Prepare conversation history
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Send to backend
      setStatus("thinking");
      const response = await apiClient.chat({
        message: userMessage,
        conversation_history: history,
        use_rag: true,
        include_vision: false,
      });

      // Add assistant response
      addMessage({ role: "assistant", content: response.text });

      // Play audio and animate if available
      if (response.audio_base64 && response.blendshapes) {
        setStatus("speaking");
        await playAudioWithLipSync(
          response.audio_base64,
          response.blendshapes
        );
      }

      setStatus("idle");
    } catch (error) {
      console.error("Chat error:", error);
      addMessage({
        role: "assistant",
        content: "죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.",
      });
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  };

  const playAudioWithLipSync = async (
    audioBase64: string,
    blendshapes: number[][]
  ): Promise<void> => {
    return new Promise((resolve) => {
      setIsPlaying(true);

      // Decode base64 audio
      const audioData = atob(audioBase64);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }

      // Create audio element
      const blob = new Blob([audioArray], { type: "audio/mp3" });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);

      // Calculate frame timing
      const fps = 60;
      const frameDuration = 1000 / fps;
      let frameIndex = 0;

      // Start blendshape animation
      const animationInterval = setInterval(() => {
        if (frameIndex < blendshapes.length) {
          setBlendshapes(blendshapes[frameIndex]);
          frameIndex++;
        }
      }, frameDuration);

      // Handle audio end
      audio.onended = () => {
        clearInterval(animationInterval);
        setBlendshapes(new Array(52).fill(0));
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        resolve();
      };

      audio.onerror = () => {
        clearInterval(animationInterval);
        setBlendshapes(new Array(52).fill(0));
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        resolve();
      };

      audio.play().catch(() => {
        clearInterval(animationInterval);
        setIsPlaying(false);
        resolve();
      });
    });
  };

  const handleVoiceResult = (text: string) => {
    setInputText(text);
    // Auto-send after voice input
    setTimeout(() => {
      if (text.trim()) {
        setInputText("");
        addMessage({ role: "user", content: text });
        handleSendMessage(text);
      }
    }, 500);
  };

  const handleSendMessage = async (text: string) => {
    setStatus("processing");
    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setStatus("thinking");
      const response = await apiClient.chat({
        message: text,
        conversation_history: history,
        use_rag: true,
        include_vision: false,
      });

      addMessage({ role: "assistant", content: response.text });

      if (response.audio_base64 && response.blendshapes) {
        setStatus("speaking");
        await playAudioWithLipSync(
          response.audio_base64,
          response.blendshapes
        );
      }

      setStatus("idle");
    } catch (error) {
      console.error("Chat error:", error);
      addMessage({
        role: "assistant",
        content: "죄송합니다. 오류가 발생했습니다.",
      });
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold">대화</h2>
        <p className="text-sm text-gray-400">도플갱어와 대화하세요</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p>아직 대화가 없습니다.</p>
            <p className="text-sm mt-2">메시지를 보내거나 음성으로 말해보세요!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={clsx(
                "message-appear max-w-[85%] rounded-lg px-4 py-2",
                message.role === "user"
                  ? "ml-auto bg-primary-600 text-white"
                  : "bg-gray-700 text-gray-100"
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <span className="text-xs opacity-60 mt-1 block">
                {message.timestamp.toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-700">
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
              "flex-1 bg-gray-700 rounded-lg px-4 py-2",
              "focus:outline-none focus:ring-2 focus:ring-primary-500",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "placeholder-gray-400"
            )}
          />

          <button
            onClick={handleSend}
            disabled={!inputText.trim() || status !== "idle" || !isConnected}
            className={clsx(
              "px-4 py-2 bg-primary-600 rounded-lg font-medium",
              "hover:bg-primary-700 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}
