using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;

namespace ChloeDoppelganger.Agent
{
    /// <summary>
    /// HTTP client for communicating with the Python backend API.
    /// </summary>
    public class ApiClient : MonoBehaviour
    {
        [Header("Server Settings")]
        [SerializeField] private string baseUrl = "http://localhost:8000";
        [SerializeField] private float timeoutSeconds = 30f;

        private string ApiUrl(string endpoint) => $"{baseUrl}{endpoint}";

        /// <summary>
        /// Send chat message and receive response with audio and blendshapes.
        /// </summary>
        public async Task<ChatResponse> Chat(ChatRequest request)
        {
            var json = JsonUtility.ToJson(new ChatRequestJson
            {
                message = request.Message,
                conversation_history = ConvertHistory(request.ConversationHistory),
                use_rag = request.UseRAG,
                include_vision = request.IncludeVision,
                image_base64 = request.ImageBase64
            });

            var response = await PostJson<ChatResponseJson>(ApiUrl("/api/chat"), json);

            return new ChatResponse
            {
                Text = response.text,
                AudioBase64 = response.audio_base64,
                Blendshapes = response.blendshapes,
                Emotion = response.emotion
            };
        }

        /// <summary>
        /// Convert text to speech.
        /// </summary>
        public async Task<TTSResponse> TextToSpeech(string text, string voiceId = null)
        {
            var json = JsonUtility.ToJson(new TTSRequestJson
            {
                text = text,
                voice_id = voiceId
            });

            var response = await PostJson<TTSResponseJson>(ApiUrl("/api/tts"), json);

            return new TTSResponse
            {
                AudioBase64 = response.audio_base64,
                DurationSeconds = response.duration_seconds
            };
        }

        /// <summary>
        /// Generate lipsync blendshapes from audio.
        /// </summary>
        public async Task<LipSyncResponse> GenerateLipSync(string audioBase64, int sampleRate = 22050)
        {
            var json = JsonUtility.ToJson(new LipSyncRequestJson
            {
                audio_base64 = audioBase64,
                sample_rate = sampleRate
            });

            var response = await PostJson<LipSyncResponseJson>(ApiUrl("/api/lipsync"), json);

            return new LipSyncResponse
            {
                Blendshapes = response.blendshapes,
                FPS = response.fps
            };
        }

        /// <summary>
        /// Add document to vector store.
        /// </summary>
        public async Task<string> AddDocument(string content, Dictionary<string, object> metadata = null)
        {
            var url = ApiUrl($"/api/documents?content={UnityWebRequest.EscapeURL(content)}");

            using var request = UnityWebRequest.PostWwwForm(url, "");
            request.timeout = (int)timeoutSeconds;

            await SendRequestAsync(request);

            var response = JsonUtility.FromJson<AddDocumentResponse>(request.downloadHandler.text);
            return response.id;
        }

        /// <summary>
        /// Check backend health status.
        /// </summary>
        public async Task<HealthStatus> CheckHealth()
        {
            try
            {
                var response = await GetJson<HealthStatusJson>(ApiUrl("/health"));
                return new HealthStatus
                {
                    Status = response.status,
                    OllamaConnected = response.ollama_connected,
                    ElevenLabsConnected = response.elevenlabs_connected,
                    NeuroSyncLoaded = response.neurosync_loaded
                };
            }
            catch
            {
                return new HealthStatus { Status = "offline" };
            }
        }

        private async Task<T> PostJson<T>(string url, string json)
        {
            using var request = new UnityWebRequest(url, "POST");
            var bodyRaw = Encoding.UTF8.GetBytes(json);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.timeout = (int)timeoutSeconds;

            await SendRequestAsync(request);

            if (request.result != UnityWebRequest.Result.Success)
            {
                throw new Exception($"API Error: {request.error}");
            }

            return JsonUtility.FromJson<T>(request.downloadHandler.text);
        }

        private async Task<T> GetJson<T>(string url)
        {
            using var request = UnityWebRequest.Get(url);
            request.timeout = (int)timeoutSeconds;

            await SendRequestAsync(request);

            if (request.result != UnityWebRequest.Result.Success)
            {
                throw new Exception($"API Error: {request.error}");
            }

            return JsonUtility.FromJson<T>(request.downloadHandler.text);
        }

        private Task SendRequestAsync(UnityWebRequest request)
        {
            var tcs = new TaskCompletionSource<bool>();
            var operation = request.SendWebRequest();

            operation.completed += _ =>
            {
                if (request.result == UnityWebRequest.Result.Success)
                {
                    tcs.SetResult(true);
                }
                else
                {
                    tcs.SetException(new Exception(request.error));
                }
            };

            return tcs.Task;
        }

        private ChatMessageJson[] ConvertHistory(List<ChatMessage> history)
        {
            if (history == null) return Array.Empty<ChatMessageJson>();

            var result = new ChatMessageJson[history.Count];
            for (int i = 0; i < history.Count; i++)
            {
                result[i] = new ChatMessageJson
                {
                    role = history[i].Role.ToString().ToLower(),
                    content = history[i].Content
                };
            }
            return result;
        }

        // JSON serialization classes
        [Serializable]
        private class ChatRequestJson
        {
            public string message;
            public ChatMessageJson[] conversation_history;
            public bool use_rag;
            public bool include_vision;
            public string image_base64;
        }

        [Serializable]
        private class ChatMessageJson
        {
            public string role;
            public string content;
        }

        [Serializable]
        private class ChatResponseJson
        {
            public string text;
            public string audio_base64;
            public float[][] blendshapes;
            public string emotion;
        }

        [Serializable]
        private class TTSRequestJson
        {
            public string text;
            public string voice_id;
        }

        [Serializable]
        private class TTSResponseJson
        {
            public string audio_base64;
            public float duration_seconds;
        }

        [Serializable]
        private class LipSyncRequestJson
        {
            public string audio_base64;
            public int sample_rate;
        }

        [Serializable]
        private class LipSyncResponseJson
        {
            public float[][] blendshapes;
            public int fps;
        }

        [Serializable]
        private class AddDocumentResponse
        {
            public string id;
            public string status;
        }

        [Serializable]
        private class HealthStatusJson
        {
            public string status;
            public bool ollama_connected;
            public bool elevenlabs_connected;
            public bool neurosync_loaded;
        }
    }

    public class TTSResponse
    {
        public string AudioBase64;
        public float DurationSeconds;
    }

    public class LipSyncResponse
    {
        public float[][] Blendshapes;
        public int FPS;
    }

    public class HealthStatus
    {
        public string Status;
        public bool OllamaConnected;
        public bool ElevenLabsConnected;
        public bool NeuroSyncLoaded;
    }
}
