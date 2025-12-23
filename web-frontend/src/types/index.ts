export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export interface ChatRequest {
  message: string;
  conversation_history: { role: string; content: string }[];
  use_rag: boolean;
  include_vision: boolean;
  image_base64?: string;
}

export interface ChatResponse {
  text: string;
  audio_base64?: string;
  blendshapes?: number[][];
  emotion?: string;
}

export interface TTSResponse {
  audio_base64: string;
  duration_seconds: number;
}

export interface LipSyncResponse {
  blendshapes: number[][];
  fps: number;
}

export interface HealthStatus {
  status: string;
  ollama_connected: boolean;
  elevenlabs_connected: boolean;
  neurosync_loaded: boolean;
}

export type AppStatus =
  | "idle"
  | "listening"
  | "processing"
  | "thinking"
  | "speaking"
  | "error";

// ARKit 52 Blendshape indices
export const ARKitBlendshapes = {
  eyeBlinkLeft: 0,
  eyeLookDownLeft: 1,
  eyeLookInLeft: 2,
  eyeLookOutLeft: 3,
  eyeLookUpLeft: 4,
  eyeSquintLeft: 5,
  eyeWideLeft: 6,
  eyeBlinkRight: 7,
  eyeLookDownRight: 8,
  eyeLookInRight: 9,
  eyeLookOutRight: 10,
  eyeLookUpRight: 11,
  eyeSquintRight: 12,
  eyeWideRight: 13,
  jawForward: 14,
  jawLeft: 15,
  jawRight: 16,
  jawOpen: 17,
  mouthClose: 18,
  mouthFunnel: 19,
  mouthPucker: 20,
  mouthLeft: 21,
  mouthRight: 22,
  mouthSmileLeft: 23,
  mouthSmileRight: 24,
  mouthFrownLeft: 25,
  mouthFrownRight: 26,
  mouthDimpleLeft: 27,
  mouthDimpleRight: 28,
  mouthStretchLeft: 29,
  mouthStretchRight: 30,
  mouthRollLower: 31,
  mouthRollUpper: 32,
  mouthShrugLower: 33,
  mouthShrugUpper: 34,
  mouthPressLeft: 35,
  mouthPressRight: 36,
  mouthLowerDownLeft: 37,
  mouthLowerDownRight: 38,
  mouthUpperUpLeft: 39,
  mouthUpperUpRight: 40,
  browDownLeft: 41,
  browDownRight: 42,
  browInnerUp: 43,
  browOuterUpLeft: 44,
  browOuterUpRight: 45,
  cheekPuff: 46,
  cheekSquintLeft: 47,
  cheekSquintRight: 48,
  noseSneerLeft: 49,
  noseSneerRight: 50,
  tongueOut: 51,
} as const;
