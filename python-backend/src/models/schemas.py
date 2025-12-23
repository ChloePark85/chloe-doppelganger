from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatMessage(BaseModel):
    role: MessageRole
    content: str


class ChatRequest(BaseModel):
    message: str
    conversation_history: List[ChatMessage] = Field(default_factory=list)
    use_rag: bool = True
    include_vision: bool = False
    image_base64: Optional[str] = None


class ChatResponse(BaseModel):
    text: str
    audio_base64: Optional[str] = None
    blendshapes: Optional[List[List[float]]] = None
    emotion: Optional[str] = None


class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None


class TTSResponse(BaseModel):
    audio_base64: str
    duration_seconds: float


class LipSyncRequest(BaseModel):
    audio_base64: str
    sample_rate: int = 22050


class LipSyncResponse(BaseModel):
    blendshapes: List[List[float]]  # ARKit 52 blendshapes per frame
    fps: int = 60


class EmbeddingRequest(BaseModel):
    text: str


class EmbeddingResponse(BaseModel):
    embedding: List[float]
    dimension: int


class DocumentChunk(BaseModel):
    id: str
    content: str
    embedding: Optional[List[float]] = None
    metadata: dict = Field(default_factory=dict)


class RAGQueryRequest(BaseModel):
    query: str
    top_k: int = 5


class RAGQueryResponse(BaseModel):
    results: List[DocumentChunk]
    query_embedding: List[float]


class HealthResponse(BaseModel):
    status: str
    ollama_connected: bool
    elevenlabs_connected: bool
    neurosync_loaded: bool
