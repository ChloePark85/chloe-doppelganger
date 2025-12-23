import base64
import io
import logging
from typing import Optional, AsyncGenerator

from elevenlabs import AsyncElevenLabs
from elevenlabs.core import ApiError

from config.settings import settings

logger = logging.getLogger(__name__)


class ElevenLabsService:
    def __init__(self):
        self.client: Optional[AsyncElevenLabs] = None
        self.voice_id = settings.ELEVENLABS_VOICE_ID
        self.model_id = settings.ELEVENLABS_MODEL_ID
        self._initialize_client()

    def _initialize_client(self):
        """Initialize ElevenLabs client if API key is available."""
        if settings.ELEVENLABS_API_KEY:
            self.client = AsyncElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
        else:
            logger.warning("ElevenLabs API key not configured")

    async def text_to_speech(
        self,
        text: str,
        voice_id: Optional[str] = None,
    ) -> tuple[bytes, float]:
        """Convert text to speech and return audio bytes with duration."""
        if not self.client:
            raise ValueError("ElevenLabs client not initialized")

        target_voice_id = voice_id or self.voice_id
        if not target_voice_id:
            raise ValueError("Voice ID not configured")

        try:
            audio_generator = await self.client.text_to_speech.convert(
                voice_id=target_voice_id,
                text=text,
                model_id=self.model_id,
                output_format="mp3_44100_128",
            )

            # Collect all audio chunks
            audio_chunks = []
            async for chunk in audio_generator:
                audio_chunks.append(chunk)

            audio_bytes = b"".join(audio_chunks)

            # Estimate duration (rough estimate based on MP3 bitrate)
            # 128 kbps = 16 KB/s
            duration_seconds = len(audio_bytes) / (16 * 1024)

            return audio_bytes, duration_seconds

        except ApiError as e:
            logger.error(f"ElevenLabs API error: {e}")
            raise
        except Exception as e:
            logger.error(f"ElevenLabs TTS error: {e}")
            raise

    async def text_to_speech_base64(
        self,
        text: str,
        voice_id: Optional[str] = None,
    ) -> tuple[str, float]:
        """Convert text to speech and return base64 encoded audio."""
        audio_bytes, duration = await self.text_to_speech(text, voice_id)
        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
        return audio_base64, duration

    async def text_to_speech_stream(
        self,
        text: str,
        voice_id: Optional[str] = None,
    ) -> AsyncGenerator[bytes, None]:
        """Stream text to speech audio chunks."""
        if not self.client:
            raise ValueError("ElevenLabs client not initialized")

        target_voice_id = voice_id or self.voice_id
        if not target_voice_id:
            raise ValueError("Voice ID not configured")

        try:
            audio_generator = await self.client.text_to_speech.convert(
                voice_id=target_voice_id,
                text=text,
                model_id=self.model_id,
                output_format="mp3_44100_128",
            )

            async for chunk in audio_generator:
                yield chunk

        except Exception as e:
            logger.error(f"ElevenLabs stream error: {e}")
            raise

    async def get_voices(self) -> list[dict]:
        """Get list of available voices."""
        if not self.client:
            raise ValueError("ElevenLabs client not initialized")

        try:
            response = await self.client.voices.get_all()
            return [
                {
                    "voice_id": voice.voice_id,
                    "name": voice.name,
                    "category": voice.category,
                }
                for voice in response.voices
            ]
        except Exception as e:
            logger.error(f"ElevenLabs get voices error: {e}")
            raise

    async def clone_voice(
        self,
        name: str,
        audio_files: list[bytes],
        description: Optional[str] = None,
    ) -> str:
        """Clone a voice from audio samples and return voice ID."""
        if not self.client:
            raise ValueError("ElevenLabs client not initialized")

        try:
            # Convert bytes to file-like objects
            files = [io.BytesIO(audio) for audio in audio_files]

            response = await self.client.voices.add(
                name=name,
                files=files,
                description=description or f"Cloned voice: {name}",
            )

            logger.info(f"Voice cloned successfully: {response.voice_id}")
            return response.voice_id

        except Exception as e:
            logger.error(f"ElevenLabs voice clone error: {e}")
            raise

    async def check_connection(self) -> bool:
        """Check if ElevenLabs API is accessible."""
        if not self.client:
            return False

        try:
            await self.client.voices.get_all()
            return True
        except Exception:
            return False


elevenlabs_service = ElevenLabsService()
