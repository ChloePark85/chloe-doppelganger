import base64
import io
import logging
from typing import Optional, List
import numpy as np

from config.settings import settings

logger = logging.getLogger(__name__)

# ARKit 52 Blendshape names
ARKIT_BLENDSHAPES = [
    "eyeBlinkLeft", "eyeLookDownLeft", "eyeLookInLeft", "eyeLookOutLeft",
    "eyeLookUpLeft", "eyeSquintLeft", "eyeWideLeft", "eyeBlinkRight",
    "eyeLookDownRight", "eyeLookInRight", "eyeLookOutRight", "eyeLookUpRight",
    "eyeSquintRight", "eyeWideRight", "jawForward", "jawLeft", "jawRight",
    "jawOpen", "mouthClose", "mouthFunnel", "mouthPucker", "mouthLeft",
    "mouthRight", "mouthSmileLeft", "mouthSmileRight", "mouthFrownLeft",
    "mouthFrownRight", "mouthDimpleLeft", "mouthDimpleRight", "mouthStretchLeft",
    "mouthStretchRight", "mouthRollLower", "mouthRollUpper", "mouthShrugLower",
    "mouthShrugUpper", "mouthPressLeft", "mouthPressRight", "mouthLowerDownLeft",
    "mouthLowerDownRight", "mouthUpperUpLeft", "mouthUpperUpRight", "browDownLeft",
    "browDownRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight",
    "cheekPuff", "cheekSquintLeft", "cheekSquintRight", "noseSneerLeft",
    "noseSneerRight", "tongueOut"
]

# Viseme to blendshape mapping (simplified)
VISEME_MAP = {
    "sil": {"jawOpen": 0.0, "mouthClose": 0.8},
    "aa": {"jawOpen": 0.6, "mouthFunnel": 0.2},
    "ae": {"jawOpen": 0.5, "mouthStretchLeft": 0.3, "mouthStretchRight": 0.3},
    "ah": {"jawOpen": 0.55, "mouthFunnel": 0.1},
    "ao": {"jawOpen": 0.5, "mouthFunnel": 0.4},
    "aw": {"jawOpen": 0.4, "mouthPucker": 0.5},
    "ay": {"jawOpen": 0.4, "mouthSmileLeft": 0.3, "mouthSmileRight": 0.3},
    "b": {"jawOpen": 0.05, "mouthClose": 0.9, "mouthPressLeft": 0.5, "mouthPressRight": 0.5},
    "ch": {"jawOpen": 0.2, "mouthFunnel": 0.5},
    "d": {"jawOpen": 0.15, "tongueOut": 0.1},
    "dh": {"jawOpen": 0.2, "tongueOut": 0.15},
    "eh": {"jawOpen": 0.35, "mouthStretchLeft": 0.2, "mouthStretchRight": 0.2},
    "er": {"jawOpen": 0.3, "mouthFunnel": 0.3},
    "ey": {"jawOpen": 0.25, "mouthSmileLeft": 0.2, "mouthSmileRight": 0.2},
    "f": {"jawOpen": 0.1, "mouthUpperUpLeft": 0.3, "mouthUpperUpRight": 0.3},
    "g": {"jawOpen": 0.2, "mouthClose": 0.3},
    "hh": {"jawOpen": 0.3, "mouthFunnel": 0.1},
    "ih": {"jawOpen": 0.2, "mouthSmileLeft": 0.4, "mouthSmileRight": 0.4},
    "iy": {"jawOpen": 0.15, "mouthSmileLeft": 0.5, "mouthSmileRight": 0.5},
    "jh": {"jawOpen": 0.25, "mouthFunnel": 0.4},
    "k": {"jawOpen": 0.15, "mouthClose": 0.4},
    "l": {"jawOpen": 0.2, "tongueOut": 0.2},
    "m": {"jawOpen": 0.0, "mouthClose": 1.0, "mouthPressLeft": 0.6, "mouthPressRight": 0.6},
    "n": {"jawOpen": 0.1, "tongueOut": 0.1},
    "ng": {"jawOpen": 0.15, "mouthClose": 0.5},
    "ow": {"jawOpen": 0.4, "mouthPucker": 0.6},
    "oy": {"jawOpen": 0.35, "mouthPucker": 0.4},
    "p": {"jawOpen": 0.0, "mouthClose": 1.0, "mouthPressLeft": 0.7, "mouthPressRight": 0.7},
    "r": {"jawOpen": 0.2, "mouthPucker": 0.3},
    "s": {"jawOpen": 0.1, "mouthSmileLeft": 0.2, "mouthSmileRight": 0.2},
    "sh": {"jawOpen": 0.15, "mouthFunnel": 0.5},
    "t": {"jawOpen": 0.1, "tongueOut": 0.05},
    "th": {"jawOpen": 0.15, "tongueOut": 0.3},
    "uh": {"jawOpen": 0.3, "mouthPucker": 0.3},
    "uw": {"jawOpen": 0.2, "mouthPucker": 0.7},
    "v": {"jawOpen": 0.1, "mouthUpperUpLeft": 0.2, "mouthUpperUpRight": 0.2},
    "w": {"jawOpen": 0.15, "mouthPucker": 0.6},
    "y": {"jawOpen": 0.2, "mouthSmileLeft": 0.3, "mouthSmileRight": 0.3},
    "z": {"jawOpen": 0.1, "mouthSmileLeft": 0.15, "mouthSmileRight": 0.15},
    "zh": {"jawOpen": 0.15, "mouthFunnel": 0.4},
}


class NeuroSyncService:
    def __init__(self):
        self.model = None
        self.sample_rate = 22050
        self.fps = 60
        self._load_model()

    def _load_model(self):
        """Load NeuroSync ONNX model if available."""
        try:
            import onnxruntime as ort
            model_path = settings.NEUROSYNC_MODEL_PATH
            # Model would be loaded here if available
            # self.model = ort.InferenceSession(model_path)
            logger.info("NeuroSync service initialized (using fallback mode)")
        except Exception as e:
            logger.warning(f"NeuroSync model not loaded: {e}")
            self.model = None

    def audio_to_blendshapes(
        self,
        audio_bytes: bytes,
        sample_rate: int = 22050,
    ) -> List[List[float]]:
        """Convert audio to ARKit blendshape animation frames."""
        try:
            import soundfile as sf

            # Load audio from bytes
            audio_buffer = io.BytesIO(audio_bytes)
            audio_data, sr = sf.read(audio_buffer)

            # Convert to mono if stereo
            if len(audio_data.shape) > 1:
                audio_data = np.mean(audio_data, axis=1)

            # Resample if necessary
            if sr != self.sample_rate:
                import librosa
                audio_data = librosa.resample(
                    audio_data, orig_sr=sr, target_sr=self.sample_rate
                )

            # Generate blendshapes using energy-based approach
            # (fallback when model is not available)
            blendshapes = self._generate_blendshapes_from_energy(audio_data)

            return blendshapes

        except Exception as e:
            logger.error(f"Audio to blendshapes error: {e}")
            raise

    def audio_base64_to_blendshapes(
        self,
        audio_base64: str,
        sample_rate: int = 22050,
    ) -> List[List[float]]:
        """Convert base64 audio to blendshapes."""
        audio_bytes = base64.b64decode(audio_base64)
        return self.audio_to_blendshapes(audio_bytes, sample_rate)

    def _generate_blendshapes_from_energy(
        self,
        audio_data: np.ndarray,
    ) -> List[List[float]]:
        """Generate blendshapes based on audio energy (fallback method)."""
        # Calculate frame parameters
        duration = len(audio_data) / self.sample_rate
        num_frames = int(duration * self.fps)

        if num_frames == 0:
            return [[0.0] * 52]

        # Calculate energy per frame
        samples_per_frame = len(audio_data) // num_frames
        blendshapes = []

        for i in range(num_frames):
            start = i * samples_per_frame
            end = start + samples_per_frame
            frame_audio = audio_data[start:end]

            # Calculate RMS energy
            energy = np.sqrt(np.mean(frame_audio ** 2))
            energy = min(energy * 10, 1.0)  # Normalize

            # Generate blendshape frame
            frame = self._energy_to_blendshape_frame(energy)
            blendshapes.append(frame)

        # Smooth the animation
        blendshapes = self._smooth_blendshapes(blendshapes)

        return blendshapes

    def _energy_to_blendshape_frame(self, energy: float) -> List[float]:
        """Convert energy level to blendshape values."""
        frame = [0.0] * 52

        # Map energy to mouth movements
        jaw_open_idx = ARKIT_BLENDSHAPES.index("jawOpen")
        mouth_close_idx = ARKIT_BLENDSHAPES.index("mouthClose")

        frame[jaw_open_idx] = energy * 0.7
        frame[mouth_close_idx] = max(0, 0.3 - energy * 0.5)

        # Add some variation
        if energy > 0.3:
            mouth_funnel_idx = ARKIT_BLENDSHAPES.index("mouthFunnel")
            frame[mouth_funnel_idx] = (energy - 0.3) * 0.5

        if energy > 0.5:
            mouth_pucker_idx = ARKIT_BLENDSHAPES.index("mouthPucker")
            frame[mouth_pucker_idx] = (energy - 0.5) * 0.3

        return frame

    def _smooth_blendshapes(
        self,
        blendshapes: List[List[float]],
        window_size: int = 3,
    ) -> List[List[float]]:
        """Apply smoothing to blendshape animation."""
        if len(blendshapes) < window_size:
            return blendshapes

        smoothed = []
        for i in range(len(blendshapes)):
            start = max(0, i - window_size // 2)
            end = min(len(blendshapes), i + window_size // 2 + 1)

            frame = [0.0] * 52
            for j in range(52):
                values = [blendshapes[k][j] for k in range(start, end)]
                frame[j] = sum(values) / len(values)

            smoothed.append(frame)

        return smoothed

    def is_loaded(self) -> bool:
        """Check if the service is ready."""
        return True  # Fallback mode always available


neurosync_service = NeuroSyncService()
