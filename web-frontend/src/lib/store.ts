import { create } from "zustand";
import type { ChatMessage, AppStatus } from "@/types";

interface AppState {
  // Status
  status: AppStatus;
  setStatus: (status: AppStatus) => void;

  // Messages
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  clearMessages: () => void;

  // Avatar
  avatarUrl: string | null;
  setAvatarUrl: (url: string | null) => void;
  blendshapes: number[];
  setBlendshapes: (values: number[]) => void;

  // Audio
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;

  // Recording
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;

  // Backend connection
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Status
  status: "idle",
  setStatus: (status) => set({ status }),

  // Messages
  messages: [],
  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
      ],
    })),
  clearMessages: () => set({ messages: [] }),

  // Avatar
  avatarUrl: null,
  setAvatarUrl: (url) => set({ avatarUrl: url }),
  blendshapes: new Array(52).fill(0),
  setBlendshapes: (values) => set({ blendshapes: values }),

  // Audio
  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  // Recording
  isRecording: false,
  setIsRecording: (recording) => set({ isRecording: recording }),

  // Backend connection
  isConnected: false,
  setIsConnected: (connected) => set({ isConnected: connected }),
}));
