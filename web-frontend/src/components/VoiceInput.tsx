"use client";

import { useState, useRef, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { clsx } from "clsx";

interface VoiceInputProps {
  onResult: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({ onResult, disabled }: VoiceInputProps) {
  const [isSupported, setIsSupported] = useState(true);
  const { isRecording, setIsRecording, setStatus } = useAppStore();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Check for Web Speech API support
  const SpeechRecognition =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const recognitionRef = useRef<any>(null);

  const startRecording = useCallback(async () => {
    if (disabled) return;

    // Try Web Speech API first (for real-time transcription)
    if (SpeechRecognition) {
      try {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = "ko-KR";

        recognitionRef.current.onstart = () => {
          setIsRecording(true);
          setStatus("listening");
        };

        recognitionRef.current.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join("");

          if (event.results[0].isFinal) {
            onResult(transcript);
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsRecording(false);
          setStatus("idle");
        };

        recognitionRef.current.onend = () => {
          setIsRecording(false);
          setStatus("idle");
        };

        recognitionRef.current.start();
        return;
      } catch (error) {
        console.error("Web Speech API error:", error);
      }
    }

    // Fallback to MediaRecorder (would send to Whisper backend)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });

        // Here you would send to Whisper backend for transcription
        // For now, just log
        console.log("Audio recorded:", audioBlob.size, "bytes");

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        setStatus("idle");

        // TODO: Send to backend for Whisper transcription
        // const text = await apiClient.transcribe(audioBlob);
        // onResult(text);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus("listening");
    } catch (error) {
      console.error("MediaRecorder error:", error);
      setIsSupported(false);
    }
  }, [disabled, SpeechRecognition, onResult, setIsRecording, setStatus]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  if (!isSupported) {
    return (
      <button
        disabled
        className="p-2 bg-gray-700 rounded-lg opacity-50 cursor-not-allowed"
        title="음성 입력이 지원되지 않습니다"
      >
        <MicOffIcon />
      </button>
    );
  }

  return (
    <button
      onClick={toggleRecording}
      disabled={disabled}
      className={clsx(
        "p-2 rounded-lg transition-all",
        isRecording
          ? "bg-red-500 hover:bg-red-600 recording-indicator"
          : "bg-gray-700 hover:bg-gray-600",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      title={isRecording ? "녹음 중지" : "음성으로 말하기"}
    >
      {isRecording ? <MicOnIcon /> : <MicIcon />}
    </button>
  );
}

function MicIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function MicOnIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}
