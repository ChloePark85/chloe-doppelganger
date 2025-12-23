import ollama
from typing import List, Optional, AsyncGenerator
import logging

from config.settings import settings
from src.models.schemas import ChatMessage, MessageRole

logger = logging.getLogger(__name__)


class OllamaService:
    def __init__(self):
        self.client = ollama.AsyncClient(host=settings.OLLAMA_BASE_URL)
        self.model = settings.OLLAMA_MODEL
        self.embedding_model = settings.OLLAMA_EMBEDDING_MODEL

    async def chat(
        self,
        message: str,
        conversation_history: List[ChatMessage],
        system_prompt: Optional[str] = None,
        context: Optional[str] = None,
    ) -> str:
        """Generate a chat response using Ollama."""
        messages = []

        # Add system prompt
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        else:
            messages.append({
                "role": "system",
                "content": self._get_default_system_prompt()
            })

        # Add RAG context if available
        if context:
            messages.append({
                "role": "system",
                "content": f"관련 정보:\n{context}\n\n위 정보를 참고하여 답변해주세요."
            })

        # Add conversation history
        for msg in conversation_history:
            messages.append({"role": msg.role.value, "content": msg.content})

        # Add current message
        messages.append({"role": "user", "content": message})

        try:
            response = await self.client.chat(
                model=self.model,
                messages=messages,
            )
            return response["message"]["content"]
        except Exception as e:
            logger.error(f"Ollama chat error: {e}")
            raise

    async def chat_stream(
        self,
        message: str,
        conversation_history: List[ChatMessage],
        system_prompt: Optional[str] = None,
        context: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream chat response from Ollama."""
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        else:
            messages.append({
                "role": "system",
                "content": self._get_default_system_prompt()
            })

        if context:
            messages.append({
                "role": "system",
                "content": f"관련 정보:\n{context}\n\n위 정보를 참고하여 답변해주세요."
            })

        for msg in conversation_history:
            messages.append({"role": msg.role.value, "content": msg.content})

        messages.append({"role": "user", "content": message})

        try:
            async for chunk in await self.client.chat(
                model=self.model,
                messages=messages,
                stream=True,
            ):
                if chunk["message"]["content"]:
                    yield chunk["message"]["content"]
        except Exception as e:
            logger.error(f"Ollama stream error: {e}")
            raise

    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding vector for text."""
        try:
            response = await self.client.embed(
                model=self.embedding_model,
                input=text,
            )
            return response["embeddings"][0]
        except Exception as e:
            logger.error(f"Ollama embedding error: {e}")
            raise

    async def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts."""
        try:
            response = await self.client.embed(
                model=self.embedding_model,
                input=texts,
            )
            return response["embeddings"]
        except Exception as e:
            logger.error(f"Ollama batch embedding error: {e}")
            raise

    async def vision_chat(
        self,
        message: str,
        image_base64: str,
        conversation_history: List[ChatMessage],
    ) -> str:
        """Chat with vision capability using image input."""
        messages = []

        messages.append({
            "role": "system",
            "content": "당신은 이미지를 분석하고 대화할 수 있는 AI 어시스턴트입니다."
        })

        for msg in conversation_history:
            messages.append({"role": msg.role.value, "content": msg.content})

        messages.append({
            "role": "user",
            "content": message,
            "images": [image_base64]
        })

        try:
            response = await self.client.chat(
                model="llava",  # Vision model
                messages=messages,
            )
            return response["message"]["content"]
        except Exception as e:
            logger.error(f"Ollama vision chat error: {e}")
            raise

    async def check_connection(self) -> bool:
        """Check if Ollama is accessible."""
        try:
            await self.client.list()
            return True
        except Exception:
            return False

    def _get_default_system_prompt(self) -> str:
        return """당신은 사용자의 디지털 도플갱어(분신)입니다.
사용자를 대신하여 자연스럽고 친근하게 대화합니다.
한국어로 대화하며, 사용자의 성격과 말투를 반영합니다.
답변은 간결하고 명확하게 하되, 필요시 상세한 설명도 제공합니다."""


ollama_service = OllamaService()
