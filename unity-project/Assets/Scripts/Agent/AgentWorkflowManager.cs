using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;

namespace ChloeDoppelganger.Agent
{
    /// <summary>
    /// Main workflow manager for the Doppelganger agent system.
    /// Coordinates between voice input, LLM processing, and avatar response.
    /// </summary>
    public class AgentWorkflowManager : MonoBehaviour
    {
        [Header("Components")]
        [SerializeField] private VoiceInputHandler voiceInputHandler;
        [SerializeField] private AvatarController avatarController;
        [SerializeField] private ApiClient apiClient;

        [Header("Settings")]
        [SerializeField] private bool useRAG = true;
        [SerializeField] private bool useVision = false;

        public event Action<string> OnUserInput;
        public event Action<string> OnAgentResponse;
        public event Action<AgentState> OnStateChanged;

        private AgentState currentState = AgentState.Idle;
        private List<ChatMessage> conversationHistory = new List<ChatMessage>();
        private WebcamCapture webcamCapture;

        public AgentState CurrentState => currentState;

        private void Awake()
        {
            if (useVision)
            {
                webcamCapture = gameObject.AddComponent<WebcamCapture>();
            }
        }

        private void Start()
        {
            InitializeComponents();
        }

        private void InitializeComponents()
        {
            if (voiceInputHandler != null)
            {
                voiceInputHandler.OnSpeechRecognized += HandleUserSpeech;
            }
        }

        private void OnDestroy()
        {
            if (voiceInputHandler != null)
            {
                voiceInputHandler.OnSpeechRecognized -= HandleUserSpeech;
            }
        }

        /// <summary>
        /// Process user input (text or voice)
        /// </summary>
        public async Task ProcessUserInput(string input)
        {
            if (string.IsNullOrEmpty(input)) return;

            SetState(AgentState.Processing);
            OnUserInput?.Invoke(input);

            try
            {
                // Add user message to history
                conversationHistory.Add(new ChatMessage
                {
                    Role = MessageRole.User,
                    Content = input
                });

                // Prepare request
                var request = new ChatRequest
                {
                    Message = input,
                    ConversationHistory = conversationHistory,
                    UseRAG = useRAG,
                    IncludeVision = useVision
                };

                // Add vision data if enabled
                if (useVision && webcamCapture != null)
                {
                    request.ImageBase64 = webcamCapture.CaptureFrame();
                }

                // Get response from backend
                SetState(AgentState.Thinking);
                var response = await apiClient.Chat(request);

                // Add assistant response to history
                conversationHistory.Add(new ChatMessage
                {
                    Role = MessageRole.Assistant,
                    Content = response.Text
                });

                OnAgentResponse?.Invoke(response.Text);

                // Play audio and animate avatar
                if (response.AudioBase64 != null && avatarController != null)
                {
                    SetState(AgentState.Speaking);
                    await avatarController.PlayResponseAsync(
                        response.AudioBase64,
                        response.Blendshapes
                    );
                }

                SetState(AgentState.Idle);
            }
            catch (Exception e)
            {
                Debug.LogError($"Error processing input: {e.Message}");
                SetState(AgentState.Error);
            }
        }

        private void HandleUserSpeech(string text)
        {
            _ = ProcessUserInput(text);
        }

        private void SetState(AgentState newState)
        {
            if (currentState != newState)
            {
                currentState = newState;
                OnStateChanged?.Invoke(newState);
                Debug.Log($"Agent state: {newState}");
            }
        }

        /// <summary>
        /// Clear conversation history
        /// </summary>
        public void ClearHistory()
        {
            conversationHistory.Clear();
        }

        /// <summary>
        /// Add context document to the RAG system
        /// </summary>
        public async Task AddContextDocument(string content, Dictionary<string, object> metadata = null)
        {
            try
            {
                await apiClient.AddDocument(content, metadata);
                Debug.Log("Document added to context");
            }
            catch (Exception e)
            {
                Debug.LogError($"Error adding document: {e.Message}");
            }
        }
    }

    public enum AgentState
    {
        Idle,
        Listening,
        Processing,
        Thinking,
        Speaking,
        Error
    }

    [Serializable]
    public class ChatMessage
    {
        public MessageRole Role;
        public string Content;
    }

    public enum MessageRole
    {
        User,
        Assistant,
        System
    }

    [Serializable]
    public class ChatRequest
    {
        public string Message;
        public List<ChatMessage> ConversationHistory;
        public bool UseRAG;
        public bool IncludeVision;
        public string ImageBase64;
    }

    [Serializable]
    public class ChatResponse
    {
        public string Text;
        public string AudioBase64;
        public float[][] Blendshapes;
        public string Emotion;
    }
}
