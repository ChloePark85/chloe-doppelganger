import asyncio
import base64
import logging
import uuid
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config.settings import settings
from src.models.schemas import (
    ChatRequest,
    ChatResponse,
    TTSRequest,
    TTSResponse,
    LipSyncRequest,
    LipSyncResponse,
    EmbeddingRequest,
    EmbeddingResponse,
    DocumentChunk,
    RAGQueryRequest,
    RAGQueryResponse,
    HealthResponse,
)
from src.services.ollama_service import ollama_service
from src.services.elevenlabs_service import elevenlabs_service
from src.services.neurosync_service import neurosync_service
from src.services.vector_db_service import vector_db_service

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Starting Chloe Doppelganger Backend...")
    yield
    logger.info("Shutting down...")
    vector_db_service.save_to_disk()


app = FastAPI(
    title="Chloe Doppelganger API",
    description="Backend API for 3D Avatar Doppelganger System",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Health Check
# =============================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check service health status."""
    ollama_ok = await ollama_service.check_connection()
    elevenlabs_ok = await elevenlabs_service.check_connection()
    neurosync_ok = neurosync_service.is_loaded()

    return HealthResponse(
        status="healthy" if all([ollama_ok, elevenlabs_ok, neurosync_ok]) else "degraded",
        ollama_connected=ollama_ok,
        elevenlabs_connected=elevenlabs_ok,
        neurosync_loaded=neurosync_ok,
    )


# =============================================================================
# Chat Endpoints
# =============================================================================

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Process chat message and return response with audio and lipsync."""
    try:
        # Get RAG context if enabled
        context = None
        if request.use_rag:
            query_embedding = await ollama_service.generate_embedding(request.message)
            relevant_docs = vector_db_service.search(query_embedding, top_k=3)
            if relevant_docs:
                context = "\n\n".join([doc.content for doc in relevant_docs])

        # Generate LLM response
        if request.include_vision and request.image_base64:
            response_text = await ollama_service.vision_chat(
                request.message,
                request.image_base64,
                request.conversation_history,
            )
        else:
            response_text = await ollama_service.chat(
                request.message,
                request.conversation_history,
                context=context,
            )

        # Generate TTS audio
        audio_base64 = None
        blendshapes = None

        try:
            audio_base64, duration = await elevenlabs_service.text_to_speech_base64(
                response_text
            )

            # Generate lipsync blendshapes
            audio_bytes = base64.b64decode(audio_base64)
            blendshapes = neurosync_service.audio_to_blendshapes(audio_bytes)

        except Exception as e:
            logger.warning(f"TTS/Lipsync generation failed: {e}")

        return ChatResponse(
            text=response_text,
            audio_base64=audio_base64,
            blendshapes=blendshapes,
        )

    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# TTS Endpoints
# =============================================================================

@app.post("/api/tts", response_model=TTSResponse)
async def text_to_speech(request: TTSRequest):
    """Convert text to speech using ElevenLabs."""
    try:
        audio_base64, duration = await elevenlabs_service.text_to_speech_base64(
            request.text,
            request.voice_id,
        )

        return TTSResponse(
            audio_base64=audio_base64,
            duration_seconds=duration,
        )

    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/voices")
async def get_voices():
    """Get available ElevenLabs voices."""
    try:
        voices = await elevenlabs_service.get_voices()
        return {"voices": voices}
    except Exception as e:
        logger.error(f"Get voices error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# LipSync Endpoints
# =============================================================================

@app.post("/api/lipsync", response_model=LipSyncResponse)
async def generate_lipsync(request: LipSyncRequest):
    """Generate lipsync blendshapes from audio."""
    try:
        blendshapes = neurosync_service.audio_base64_to_blendshapes(
            request.audio_base64,
            request.sample_rate,
        )

        return LipSyncResponse(
            blendshapes=blendshapes,
            fps=neurosync_service.fps,
        )

    except Exception as e:
        logger.error(f"LipSync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Embedding & RAG Endpoints
# =============================================================================

@app.post("/api/embedding", response_model=EmbeddingResponse)
async def generate_embedding(request: EmbeddingRequest):
    """Generate embedding vector for text."""
    try:
        embedding = await ollama_service.generate_embedding(request.text)

        return EmbeddingResponse(
            embedding=embedding,
            dimension=len(embedding),
        )

    except Exception as e:
        logger.error(f"Embedding error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/documents")
async def add_document(content: str, metadata: Optional[dict] = None):
    """Add a document to the vector store."""
    try:
        embedding = await ollama_service.generate_embedding(content)

        chunk = DocumentChunk(
            id=str(uuid.uuid4()),
            content=content,
            embedding=embedding,
            metadata=metadata or {},
        )

        doc_id = vector_db_service.add_document(chunk)

        return {"id": doc_id, "status": "added"}

    except Exception as e:
        logger.error(f"Add document error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rag/query", response_model=RAGQueryResponse)
async def rag_query(request: RAGQueryRequest):
    """Query the vector store for relevant documents."""
    try:
        query_embedding = await ollama_service.generate_embedding(request.query)
        results = vector_db_service.search(query_embedding, request.top_k)

        return RAGQueryResponse(
            results=results,
            query_embedding=query_embedding,
        )

    except Exception as e:
        logger.error(f"RAG query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents/stats")
async def get_document_stats():
    """Get vector store statistics."""
    return vector_db_service.get_stats()


# =============================================================================
# WebSocket for Streaming
# =============================================================================

@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket endpoint for streaming chat."""
    await websocket.accept()
    logger.info("WebSocket connection established")

    try:
        while True:
            data = await websocket.receive_json()

            message = data.get("message", "")
            history = data.get("history", [])

            # Stream LLM response
            full_response = ""
            async for chunk in ollama_service.chat_stream(message, history):
                full_response += chunk
                await websocket.send_json({
                    "type": "text_chunk",
                    "content": chunk,
                })

            # Generate TTS and lipsync
            try:
                audio_base64, duration = await elevenlabs_service.text_to_speech_base64(
                    full_response
                )
                audio_bytes = base64.b64decode(audio_base64)
                blendshapes = neurosync_service.audio_to_blendshapes(audio_bytes)

                await websocket.send_json({
                    "type": "audio",
                    "audio_base64": audio_base64,
                    "blendshapes": blendshapes,
                    "duration": duration,
                })

            except Exception as e:
                logger.warning(f"TTS generation failed: {e}")

            await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close()


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.api.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
