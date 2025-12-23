using System;
using System.Collections;
using UnityEngine;

namespace ChloeDoppelganger.Agent
{
    /// <summary>
    /// Handles voice input using Unity's built-in microphone and Whisper STT.
    /// </summary>
    public class VoiceInputHandler : MonoBehaviour
    {
        [Header("Microphone Settings")]
        [SerializeField] private string microphoneDevice = null;
        [SerializeField] private int sampleRate = 16000;
        [SerializeField] private int recordingLengthSeconds = 10;

        [Header("Voice Activity Detection")]
        [SerializeField] private float silenceThreshold = 0.01f;
        [SerializeField] private float silenceDuration = 1.5f;
        [SerializeField] private float minRecordingDuration = 0.5f;

        [Header("Whisper Settings")]
        [SerializeField] private string whisperEndpoint = "http://localhost:8000/api/stt";

        public event Action<string> OnSpeechRecognized;
        public event Action OnRecordingStarted;
        public event Action OnRecordingEnded;

        private AudioClip recordingClip;
        private bool isRecording;
        private float silenceTimer;
        private float recordingStartTime;
        private int lastSamplePosition;

        public bool IsRecording => isRecording;

        private void Start()
        {
            InitializeMicrophone();
        }

        private void InitializeMicrophone()
        {
            if (Microphone.devices.Length == 0)
            {
                Debug.LogError("No microphone devices found!");
                return;
            }

            if (string.IsNullOrEmpty(microphoneDevice))
            {
                microphoneDevice = Microphone.devices[0];
            }

            Debug.Log($"Using microphone: {microphoneDevice}");
        }

        /// <summary>
        /// Start continuous listening with voice activity detection.
        /// </summary>
        public void StartListening()
        {
            if (isRecording) return;

            StartCoroutine(ListenContinuously());
        }

        /// <summary>
        /// Stop listening.
        /// </summary>
        public void StopListening()
        {
            isRecording = false;
            StopAllCoroutines();

            if (Microphone.IsRecording(microphoneDevice))
            {
                Microphone.End(microphoneDevice);
            }
        }

        /// <summary>
        /// Record a single utterance and transcribe.
        /// </summary>
        public void RecordAndTranscribe()
        {
            if (isRecording) return;

            StartCoroutine(RecordSingleUtterance());
        }

        private IEnumerator ListenContinuously()
        {
            isRecording = true;
            Debug.Log("Started continuous listening");

            while (isRecording)
            {
                // Start recording
                recordingClip = Microphone.Start(
                    microphoneDevice,
                    true,
                    recordingLengthSeconds,
                    sampleRate
                );

                yield return new WaitUntil(() => Microphone.GetPosition(microphoneDevice) > 0);

                OnRecordingStarted?.Invoke();
                recordingStartTime = Time.time;
                silenceTimer = 0f;
                lastSamplePosition = 0;

                bool voiceDetected = false;

                // Monitor for voice activity
                while (isRecording)
                {
                    int currentPosition = Microphone.GetPosition(microphoneDevice);

                    if (currentPosition > lastSamplePosition)
                    {
                        int sampleCount = currentPosition - lastSamplePosition;
                        float[] samples = new float[sampleCount];
                        recordingClip.GetData(samples, lastSamplePosition);

                        float maxAmplitude = GetMaxAmplitude(samples);

                        if (maxAmplitude > silenceThreshold)
                        {
                            voiceDetected = true;
                            silenceTimer = 0f;
                        }
                        else if (voiceDetected)
                        {
                            silenceTimer += Time.deltaTime;

                            if (silenceTimer >= silenceDuration)
                            {
                                // End of utterance detected
                                float duration = Time.time - recordingStartTime;

                                if (duration >= minRecordingDuration)
                                {
                                    Microphone.End(microphoneDevice);
                                    OnRecordingEnded?.Invoke();

                                    yield return StartCoroutine(TranscribeAudio(recordingClip, currentPosition));
                                }

                                break;
                            }
                        }

                        lastSamplePosition = currentPosition;
                    }

                    yield return null;
                }
            }
        }

        private IEnumerator RecordSingleUtterance()
        {
            isRecording = true;

            recordingClip = Microphone.Start(
                microphoneDevice,
                false,
                recordingLengthSeconds,
                sampleRate
            );

            yield return new WaitUntil(() => Microphone.GetPosition(microphoneDevice) > 0);

            OnRecordingStarted?.Invoke();

            // Wait for user to finish speaking (simplified - wait for silence)
            float timer = 0f;
            silenceTimer = 0f;

            while (timer < recordingLengthSeconds && silenceTimer < silenceDuration)
            {
                int position = Microphone.GetPosition(microphoneDevice);
                float[] samples = new float[sampleRate / 10]; // 100ms chunks

                if (position > samples.Length)
                {
                    recordingClip.GetData(samples, position - samples.Length);
                    float amplitude = GetMaxAmplitude(samples);

                    if (amplitude < silenceThreshold)
                    {
                        silenceTimer += 0.1f;
                    }
                    else
                    {
                        silenceTimer = 0f;
                    }
                }

                timer += 0.1f;
                yield return new WaitForSeconds(0.1f);
            }

            int finalPosition = Microphone.GetPosition(microphoneDevice);
            Microphone.End(microphoneDevice);

            OnRecordingEnded?.Invoke();
            isRecording = false;

            yield return StartCoroutine(TranscribeAudio(recordingClip, finalPosition));
        }

        private IEnumerator TranscribeAudio(AudioClip clip, int sampleCount)
        {
            // Convert audio to bytes
            float[] samples = new float[sampleCount];
            clip.GetData(samples, 0);

            byte[] audioBytes = ConvertToWav(samples, clip.frequency, clip.channels);
            string audioBase64 = Convert.ToBase64String(audioBytes);

            // For now, we'll use a placeholder since Whisper integration
            // would require additional setup. In production, send to Whisper API.
            Debug.Log("Audio recorded, transcription would happen here");

            // Simulated transcription result
            // In production: yield return SendToWhisper(audioBase64);
            OnSpeechRecognized?.Invoke("[Transcribed text would appear here]");

            yield return null;
        }

        private float GetMaxAmplitude(float[] samples)
        {
            float max = 0f;
            foreach (float sample in samples)
            {
                float abs = Mathf.Abs(sample);
                if (abs > max) max = abs;
            }
            return max;
        }

        private byte[] ConvertToWav(float[] samples, int frequency, int channels)
        {
            // WAV file header + data
            int sampleCount = samples.Length;
            int byteCount = sampleCount * 2; // 16-bit audio

            byte[] wav = new byte[44 + byteCount];

            // RIFF header
            System.Text.Encoding.ASCII.GetBytes("RIFF").CopyTo(wav, 0);
            BitConverter.GetBytes(36 + byteCount).CopyTo(wav, 4);
            System.Text.Encoding.ASCII.GetBytes("WAVE").CopyTo(wav, 8);

            // fmt chunk
            System.Text.Encoding.ASCII.GetBytes("fmt ").CopyTo(wav, 12);
            BitConverter.GetBytes(16).CopyTo(wav, 16);
            BitConverter.GetBytes((short)1).CopyTo(wav, 20); // PCM
            BitConverter.GetBytes((short)channels).CopyTo(wav, 22);
            BitConverter.GetBytes(frequency).CopyTo(wav, 24);
            BitConverter.GetBytes(frequency * channels * 2).CopyTo(wav, 28);
            BitConverter.GetBytes((short)(channels * 2)).CopyTo(wav, 32);
            BitConverter.GetBytes((short)16).CopyTo(wav, 34);

            // data chunk
            System.Text.Encoding.ASCII.GetBytes("data").CopyTo(wav, 36);
            BitConverter.GetBytes(byteCount).CopyTo(wav, 40);

            // Convert float samples to 16-bit PCM
            int offset = 44;
            foreach (float sample in samples)
            {
                short value = (short)(sample * 32767f);
                BitConverter.GetBytes(value).CopyTo(wav, offset);
                offset += 2;
            }

            return wav;
        }
    }
}
