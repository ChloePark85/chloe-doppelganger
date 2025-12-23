using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace ChloeDoppelganger.Agent
{
    /// <summary>
    /// Main UI controller for the Doppelganger application.
    /// </summary>
    public class DoppelgangerUI : MonoBehaviour
    {
        [Header("Components")]
        [SerializeField] private AgentWorkflowManager agentManager;
        [SerializeField] private VoiceInputHandler voiceInput;

        [Header("UI Elements")]
        [SerializeField] private TMP_InputField textInput;
        [SerializeField] private Button sendButton;
        [SerializeField] private Button voiceButton;
        [SerializeField] private TextMeshProUGUI statusText;
        [SerializeField] private TextMeshProUGUI responseText;
        [SerializeField] private ScrollRect chatScrollRect;
        [SerializeField] private Transform chatContent;
        [SerializeField] private GameObject userMessagePrefab;
        [SerializeField] private GameObject assistantMessagePrefab;

        [Header("Status Indicators")]
        [SerializeField] private Image statusIndicator;
        [SerializeField] private Color idleColor = Color.green;
        [SerializeField] private Color listeningColor = Color.yellow;
        [SerializeField] private Color processingColor = Color.blue;
        [SerializeField] private Color speakingColor = Color.cyan;
        [SerializeField] private Color errorColor = Color.red;

        private bool isVoiceMode;

        private void Start()
        {
            SetupEventListeners();
            UpdateStatus(AgentState.Idle);
        }

        private void SetupEventListeners()
        {
            if (sendButton != null)
            {
                sendButton.onClick.AddListener(OnSendClicked);
            }

            if (voiceButton != null)
            {
                voiceButton.onClick.AddListener(OnVoiceClicked);
            }

            if (textInput != null)
            {
                textInput.onSubmit.AddListener(OnTextSubmit);
            }

            if (agentManager != null)
            {
                agentManager.OnStateChanged += UpdateStatus;
                agentManager.OnUserInput += OnUserInput;
                agentManager.OnAgentResponse += OnAgentResponse;
            }

            if (voiceInput != null)
            {
                voiceInput.OnRecordingStarted += OnRecordingStarted;
                voiceInput.OnRecordingEnded += OnRecordingEnded;
            }
        }

        private void OnDestroy()
        {
            if (agentManager != null)
            {
                agentManager.OnStateChanged -= UpdateStatus;
                agentManager.OnUserInput -= OnUserInput;
                agentManager.OnAgentResponse -= OnAgentResponse;
            }

            if (voiceInput != null)
            {
                voiceInput.OnRecordingStarted -= OnRecordingStarted;
                voiceInput.OnRecordingEnded -= OnRecordingEnded;
            }
        }

        private void OnSendClicked()
        {
            SendTextMessage();
        }

        private void OnTextSubmit(string text)
        {
            SendTextMessage();
        }

        private void SendTextMessage()
        {
            if (textInput == null || string.IsNullOrWhiteSpace(textInput.text)) return;

            string message = textInput.text.Trim();
            textInput.text = "";

            if (agentManager != null)
            {
                _ = agentManager.ProcessUserInput(message);
            }
        }

        private void OnVoiceClicked()
        {
            if (voiceInput == null) return;

            if (isVoiceMode)
            {
                voiceInput.StopListening();
                isVoiceMode = false;
                UpdateVoiceButtonState();
            }
            else
            {
                voiceInput.StartListening();
                isVoiceMode = true;
                UpdateVoiceButtonState();
            }
        }

        private void UpdateVoiceButtonState()
        {
            if (voiceButton == null) return;

            var buttonText = voiceButton.GetComponentInChildren<TextMeshProUGUI>();
            if (buttonText != null)
            {
                buttonText.text = isVoiceMode ? "Stop" : "Voice";
            }

            var buttonImage = voiceButton.GetComponent<Image>();
            if (buttonImage != null)
            {
                buttonImage.color = isVoiceMode ? listeningColor : Color.white;
            }
        }

        private void OnRecordingStarted()
        {
            UpdateStatus(AgentState.Listening);
        }

        private void OnRecordingEnded()
        {
            UpdateStatus(AgentState.Processing);
        }

        private void UpdateStatus(AgentState state)
        {
            if (statusText != null)
            {
                statusText.text = GetStatusText(state);
            }

            if (statusIndicator != null)
            {
                statusIndicator.color = GetStatusColor(state);
            }
        }

        private string GetStatusText(AgentState state)
        {
            return state switch
            {
                AgentState.Idle => "Ready",
                AgentState.Listening => "Listening...",
                AgentState.Processing => "Processing...",
                AgentState.Thinking => "Thinking...",
                AgentState.Speaking => "Speaking...",
                AgentState.Error => "Error",
                _ => "Unknown"
            };
        }

        private Color GetStatusColor(AgentState state)
        {
            return state switch
            {
                AgentState.Idle => idleColor,
                AgentState.Listening => listeningColor,
                AgentState.Processing => processingColor,
                AgentState.Thinking => processingColor,
                AgentState.Speaking => speakingColor,
                AgentState.Error => errorColor,
                _ => Color.gray
            };
        }

        private void OnUserInput(string text)
        {
            AddChatMessage(text, true);
        }

        private void OnAgentResponse(string text)
        {
            AddChatMessage(text, false);

            if (responseText != null)
            {
                responseText.text = text;
            }
        }

        private void AddChatMessage(string text, bool isUser)
        {
            if (chatContent == null) return;

            var prefab = isUser ? userMessagePrefab : assistantMessagePrefab;
            if (prefab == null) return;

            var messageObj = Instantiate(prefab, chatContent);
            var messageText = messageObj.GetComponentInChildren<TextMeshProUGUI>();

            if (messageText != null)
            {
                messageText.text = text;
            }

            // Scroll to bottom
            if (chatScrollRect != null)
            {
                Canvas.ForceUpdateCanvases();
                chatScrollRect.verticalNormalizedPosition = 0f;
            }
        }

        /// <summary>
        /// Clear chat history UI.
        /// </summary>
        public void ClearChat()
        {
            if (chatContent == null) return;

            foreach (Transform child in chatContent)
            {
                Destroy(child.gameObject);
            }

            if (agentManager != null)
            {
                agentManager.ClearHistory();
            }
        }
    }
}
