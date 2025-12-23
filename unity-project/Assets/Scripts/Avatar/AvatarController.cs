using System;
using System.Collections;
using System.Threading.Tasks;
using UnityEngine;

namespace ChloeDoppelganger.Agent
{
    /// <summary>
    /// Controls the 3D avatar, including blendshape animations and audio playback.
    /// </summary>
    public class AvatarController : MonoBehaviour
    {
        [Header("Avatar Components")]
        [SerializeField] private SkinnedMeshRenderer faceRenderer;
        [SerializeField] private AudioSource audioSource;
        [SerializeField] private Animator animator;

        [Header("Blendshape Settings")]
        [SerializeField] private BlendshapeMapping[] blendshapeMappings;
        [SerializeField] private float blendshapeSmoothing = 0.1f;

        [Header("Animation Settings")]
        [SerializeField] private int targetFPS = 60;
        [SerializeField] private bool useIdleAnimations = true;

        private float[] currentBlendshapeValues;
        private float[] targetBlendshapeValues;
        private Coroutine animationCoroutine;
        private bool isPlaying;

        public bool IsPlaying => isPlaying;

        private void Awake()
        {
            InitializeBlendshapes();
        }

        private void Update()
        {
            if (!isPlaying && useIdleAnimations)
            {
                UpdateIdleAnimation();
            }

            // Smooth blendshape transitions
            SmoothBlendshapes();
        }

        private void InitializeBlendshapes()
        {
            if (faceRenderer == null) return;

            int blendshapeCount = faceRenderer.sharedMesh.blendShapeCount;
            currentBlendshapeValues = new float[blendshapeCount];
            targetBlendshapeValues = new float[blendshapeCount];

            Debug.Log($"Initialized {blendshapeCount} blendshapes");
        }

        /// <summary>
        /// Play response with audio and lipsync animation.
        /// </summary>
        public async Task PlayResponseAsync(string audioBase64, float[][] blendshapes)
        {
            if (isPlaying)
            {
                StopPlayback();
            }

            isPlaying = true;

            try
            {
                // Decode and play audio
                byte[] audioBytes = Convert.FromBase64String(audioBase64);
                AudioClip clip = await DecodeAudioClip(audioBytes);

                if (clip != null)
                {
                    audioSource.clip = clip;
                    audioSource.Play();

                    // Start blendshape animation
                    if (blendshapes != null && blendshapes.Length > 0)
                    {
                        animationCoroutine = StartCoroutine(AnimateBlendshapes(blendshapes, clip.length));
                    }

                    // Wait for audio to finish
                    await Task.Delay((int)(clip.length * 1000));
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Error playing response: {e.Message}");
            }
            finally
            {
                isPlaying = false;
                ResetBlendshapes();
            }
        }

        /// <summary>
        /// Stop current playback.
        /// </summary>
        public void StopPlayback()
        {
            if (animationCoroutine != null)
            {
                StopCoroutine(animationCoroutine);
                animationCoroutine = null;
            }

            if (audioSource.isPlaying)
            {
                audioSource.Stop();
            }

            isPlaying = false;
            ResetBlendshapes();
        }

        /// <summary>
        /// Set a specific blendshape value.
        /// </summary>
        public void SetBlendshape(string name, float value)
        {
            if (faceRenderer == null) return;

            int index = faceRenderer.sharedMesh.GetBlendShapeIndex(name);
            if (index >= 0)
            {
                targetBlendshapeValues[index] = Mathf.Clamp01(value) * 100f;
            }
        }

        /// <summary>
        /// Set blendshape by ARKit index.
        /// </summary>
        public void SetBlendshapeByIndex(int arkitIndex, float value)
        {
            if (blendshapeMappings == null || arkitIndex >= blendshapeMappings.Length) return;

            var mapping = blendshapeMappings[arkitIndex];
            if (mapping.meshIndex >= 0)
            {
                targetBlendshapeValues[mapping.meshIndex] = Mathf.Clamp01(value) * 100f * mapping.scale;
            }
        }

        private IEnumerator AnimateBlendshapes(float[][] frames, float duration)
        {
            float frameInterval = duration / frames.Length;
            float elapsed = 0f;
            int currentFrame = 0;

            while (currentFrame < frames.Length)
            {
                // Apply current frame's blendshapes
                float[] frame = frames[currentFrame];
                ApplyBlendshapeFrame(frame);

                elapsed += Time.deltaTime;

                // Advance to next frame based on elapsed time
                int targetFrame = Mathf.FloorToInt(elapsed / frameInterval);
                currentFrame = Mathf.Min(targetFrame, frames.Length - 1);

                yield return null;
            }

            ResetBlendshapes();
        }

        private void ApplyBlendshapeFrame(float[] arkitValues)
        {
            if (arkitValues == null) return;

            // Map ARKit blendshapes to mesh blendshapes
            for (int i = 0; i < Mathf.Min(arkitValues.Length, 52); i++)
            {
                SetBlendshapeByIndex(i, arkitValues[i]);
            }
        }

        private void SmoothBlendshapes()
        {
            if (faceRenderer == null || currentBlendshapeValues == null) return;

            for (int i = 0; i < currentBlendshapeValues.Length; i++)
            {
                currentBlendshapeValues[i] = Mathf.Lerp(
                    currentBlendshapeValues[i],
                    targetBlendshapeValues[i],
                    Time.deltaTime / blendshapeSmoothing
                );

                faceRenderer.SetBlendShapeWeight(i, currentBlendshapeValues[i]);
            }
        }

        private void ResetBlendshapes()
        {
            if (targetBlendshapeValues == null) return;

            for (int i = 0; i < targetBlendshapeValues.Length; i++)
            {
                targetBlendshapeValues[i] = 0f;
            }
        }

        private void UpdateIdleAnimation()
        {
            // Subtle breathing and blinking animation
            float breathe = Mathf.Sin(Time.time * 0.5f) * 0.02f;
            float blink = Mathf.PingPong(Time.time * 0.3f, 1f) > 0.95f ? 1f : 0f;

            // Apply subtle idle movements (indices would need to be configured)
            SetBlendshape("eyeBlinkLeft", blink);
            SetBlendshape("eyeBlinkRight", blink);
        }

        private async Task<AudioClip> DecodeAudioClip(byte[] audioData)
        {
            // For MP3 decoding, we'll need to use a library like NAudio or similar
            // For now, this is a placeholder that would need proper implementation
            // based on the audio format (MP3 from ElevenLabs)

            // Simple WAV decoding (if the backend sends WAV)
            try
            {
                // Check if it's a WAV file
                if (audioData.Length > 44 &&
                    audioData[0] == 'R' && audioData[1] == 'I' &&
                    audioData[2] == 'F' && audioData[3] == 'F')
                {
                    return DecodeWav(audioData);
                }

                // For MP3, you would need additional library support
                Debug.LogWarning("MP3 decoding requires additional library. Consider using WAV format.");
                return null;
            }
            catch (Exception e)
            {
                Debug.LogError($"Audio decode error: {e.Message}");
                return null;
            }
        }

        private AudioClip DecodeWav(byte[] wavData)
        {
            // Parse WAV header
            int channels = BitConverter.ToInt16(wavData, 22);
            int sampleRate = BitConverter.ToInt32(wavData, 24);
            int dataSize = BitConverter.ToInt32(wavData, 40);

            int sampleCount = dataSize / 2; // 16-bit audio
            float[] samples = new float[sampleCount];

            // Convert 16-bit PCM to float
            for (int i = 0; i < sampleCount; i++)
            {
                short value = BitConverter.ToInt16(wavData, 44 + i * 2);
                samples[i] = value / 32768f;
            }

            AudioClip clip = AudioClip.Create(
                "Response",
                sampleCount / channels,
                channels,
                sampleRate,
                false
            );

            clip.SetData(samples, 0);
            return clip;
        }
    }

    [Serializable]
    public class BlendshapeMapping
    {
        public string arkitName;
        public int meshIndex = -1;
        public float scale = 1f;
    }
}
