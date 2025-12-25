import type {
  ChatRequest,
  ChatResponse,
  HealthStatus,
  TTSResponse,
  LipSyncResponse,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async healthCheck(): Promise<HealthStatus> {
    return this.request<HealthStatus>("/health");
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    return this.request<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async textToSpeech(text: string, voiceId?: string): Promise<TTSResponse> {
    return this.request<TTSResponse>("/api/tts", {
      method: "POST",
      body: JSON.stringify({ text, voice_id: voiceId }),
    });
  }

  async generateLipSync(
    audioBase64: string,
    sampleRate: number = 22050
  ): Promise<LipSyncResponse> {
    return this.request<LipSyncResponse>("/api/lipsync", {
      method: "POST",
      body: JSON.stringify({ audio_base64: audioBase64, sample_rate: sampleRate }),
    });
  }

  async addDocument(
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<{ id: string }> {
    const params = new URLSearchParams({ content });
    return this.request(`/api/documents?${params}`, {
      method: "POST",
    });
  }
}

export const apiClient = new ApiClient();

// WebSocket connection for streaming
export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private url: string;

  constructor(url: string = `${API_URL.replace("http", "ws")}/ws/chat`) {
    this.url = url;
  }

  connect(
    onTextChunk: (chunk: string) => void,
    onAudio: (audioBase64: string, blendshapes: number[][]) => void,
    onDone: () => void,
    onError: (error: Error) => void
  ): void {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("WebSocket connected");
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "text_chunk":
          onTextChunk(data.content);
          break;
        case "audio":
          onAudio(data.audio_base64, data.blendshapes);
          break;
        case "done":
          onDone();
          break;
      }
    };

    this.ws.onerror = (event) => {
      onError(new Error("WebSocket error"));
    };

    this.ws.onclose = () => {
      console.log("WebSocket closed");
    };
  }

  send(message: string, history: { role: string; content: string }[]): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ message, history }));
    }
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
