using System;
using UnityEngine;

namespace ChloeDoppelganger.Agent
{
    /// <summary>
    /// Captures webcam frames for vision-based AI interactions.
    /// </summary>
    public class WebcamCapture : MonoBehaviour
    {
        [Header("Webcam Settings")]
        [SerializeField] private int requestedWidth = 640;
        [SerializeField] private int requestedHeight = 480;
        [SerializeField] private int requestedFPS = 30;

        [Header("Output Settings")]
        [SerializeField] private int outputWidth = 512;
        [SerializeField] private int outputHeight = 512;
        [SerializeField] private int jpegQuality = 75;

        private WebCamTexture webcamTexture;
        private Texture2D outputTexture;
        private bool isInitialized;

        public bool IsActive => webcamTexture != null && webcamTexture.isPlaying;
        public Texture2D CurrentFrame => outputTexture;

        private void Start()
        {
            Initialize();
        }

        private void OnDestroy()
        {
            StopCapture();
        }

        /// <summary>
        /// Initialize webcam capture.
        /// </summary>
        public void Initialize()
        {
            if (isInitialized) return;

            WebCamDevice[] devices = WebCamTexture.devices;

            if (devices.Length == 0)
            {
                Debug.LogWarning("No webcam devices found!");
                return;
            }

            webcamTexture = new WebCamTexture(
                devices[0].name,
                requestedWidth,
                requestedHeight,
                requestedFPS
            );

            outputTexture = new Texture2D(outputWidth, outputHeight, TextureFormat.RGB24, false);

            isInitialized = true;
            Debug.Log($"Webcam initialized: {devices[0].name}");
        }

        /// <summary>
        /// Start webcam capture.
        /// </summary>
        public void StartCapture()
        {
            if (!isInitialized)
            {
                Initialize();
            }

            if (webcamTexture != null && !webcamTexture.isPlaying)
            {
                webcamTexture.Play();
                Debug.Log("Webcam capture started");
            }
        }

        /// <summary>
        /// Stop webcam capture.
        /// </summary>
        public void StopCapture()
        {
            if (webcamTexture != null && webcamTexture.isPlaying)
            {
                webcamTexture.Stop();
                Debug.Log("Webcam capture stopped");
            }
        }

        /// <summary>
        /// Capture current frame and return as base64 encoded JPEG.
        /// </summary>
        public string CaptureFrame()
        {
            if (!IsActive)
            {
                Debug.LogWarning("Webcam is not active!");
                return null;
            }

            try
            {
                // Get pixels from webcam
                Color[] pixels = webcamTexture.GetPixels();

                // Create temporary texture at webcam resolution
                Texture2D tempTexture = new Texture2D(
                    webcamTexture.width,
                    webcamTexture.height,
                    TextureFormat.RGB24,
                    false
                );
                tempTexture.SetPixels(pixels);
                tempTexture.Apply();

                // Scale to output size
                RenderTexture rt = RenderTexture.GetTemporary(outputWidth, outputHeight);
                Graphics.Blit(tempTexture, rt);

                RenderTexture previous = RenderTexture.active;
                RenderTexture.active = rt;

                outputTexture.ReadPixels(new Rect(0, 0, outputWidth, outputHeight), 0, 0);
                outputTexture.Apply();

                RenderTexture.active = previous;
                RenderTexture.ReleaseTemporary(rt);

                Destroy(tempTexture);

                // Encode to JPEG and return base64
                byte[] jpegData = outputTexture.EncodeToJPG(jpegQuality);
                return Convert.ToBase64String(jpegData);
            }
            catch (Exception e)
            {
                Debug.LogError($"Error capturing frame: {e.Message}");
                return null;
            }
        }

        /// <summary>
        /// Get the raw webcam texture for display.
        /// </summary>
        public WebCamTexture GetWebcamTexture()
        {
            return webcamTexture;
        }
    }
}
