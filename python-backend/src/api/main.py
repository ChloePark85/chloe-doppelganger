import asyncio
import base64
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

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
from src.services.document_service import document_service
from src.services.memory_service import memory_service
from src.services.persona_service import persona_service
from src.services.calendar_service import calendar_service

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
        # Get persona system prompt
        system_prompt = await persona_service.get_system_prompt()

        # Get facts about user as additional context
        facts_context = await memory_service.get_facts_as_context()

        # Get RAG context if enabled
        rag_context = None
        if request.use_rag:
            query_embedding = await ollama_service.generate_embedding(request.message)
            relevant_docs = vector_db_service.search(query_embedding, top_k=3)
            if relevant_docs:
                rag_context = "\n\n".join([doc.content for doc in relevant_docs])

        # Combine all context
        full_context = "\n\n".join(filter(None, [facts_context, rag_context]))

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
                system_prompt=system_prompt,
                context=full_context if full_context else None,
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
# Document Upload Endpoints
# =============================================================================

@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    chunk_size: int = Form(500),
):
    """Upload and process a document for RAG."""
    try:
        # Check file type
        if not any(file.filename.endswith(ext) for ext in document_service.SUPPORTED_EXTENSIONS):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Supported: {document_service.SUPPORTED_EXTENSIONS}"
            )

        # Read and parse document
        content = await file.read()
        text = await document_service.parse_document(content, file.filename)

        # Chunk the text
        chunks = document_service.chunk_text(text, chunk_size=chunk_size)

        # Add chunks to vector store
        added_ids = []
        for i, chunk_text in enumerate(chunks):
            embedding = await ollama_service.generate_embedding(chunk_text)
            chunk = DocumentChunk(
                id=str(uuid.uuid4()),
                content=chunk_text,
                embedding=embedding,
                metadata={
                    "source": file.filename,
                    "chunk_index": i,
                },
            )
            doc_id = vector_db_service.add_document(chunk)
            added_ids.append(doc_id)

        vector_db_service.save_to_disk()

        return {
            "status": "success",
            "filename": file.filename,
            "chunks_added": len(added_ids),
            "ids": added_ids,
        }

    except Exception as e:
        logger.error(f"Document upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Memory Endpoints
# =============================================================================

@app.get("/api/memory/facts")
async def get_facts(category: Optional[str] = None):
    """Get all stored facts."""
    facts = await memory_service.get_facts(category)
    return {"facts": facts}


@app.post("/api/memory/facts")
async def save_fact(
    category: str = Form(...),
    key: str = Form(...),
    value: str = Form(...),
    source: Optional[str] = Form(None),
):
    """Save a fact about the user."""
    await memory_service.save_fact(category, key, value, source)
    return {"status": "saved", "category": category, "key": key}


@app.delete("/api/memory/facts")
async def delete_fact(category: str, key: str):
    """Delete a fact."""
    deleted = await memory_service.delete_fact(category, key)
    if deleted:
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="Fact not found")


@app.post("/api/memory/save")
async def save_memory(
    content: str = Form(...),
    importance: int = Form(5),
    tags: Optional[str] = Form(None),
):
    """Save an important memory."""
    tag_list = tags.split(",") if tags else None
    await memory_service.save_memory(content, importance, tag_list)
    return {"status": "saved"}


@app.get("/api/memory/search")
async def search_memories(query: str, limit: int = 10):
    """Search through memories."""
    results = await memory_service.search_memories(query, limit)
    return {"results": results}


# =============================================================================
# Persona Endpoints
# =============================================================================

@app.get("/api/persona")
async def get_persona():
    """Get current persona settings."""
    persona = await persona_service.get_persona()
    return persona


@app.put("/api/persona")
async def update_persona(updates: dict):
    """Update persona settings."""
    persona = await persona_service.update_persona(updates)
    return persona


@app.post("/api/persona/reset")
async def reset_persona():
    """Reset persona to defaults."""
    await persona_service.reset()
    return {"status": "reset"}


@app.get("/api/persona/prompt")
async def get_persona_prompt():
    """Get the generated system prompt."""
    prompt = await persona_service.get_system_prompt()
    return {"prompt": prompt}


# =============================================================================
# Calendar Endpoints
# =============================================================================

@app.get("/api/calendar/status")
async def calendar_status():
    """Check Google Calendar connection status."""
    is_auth = await calendar_service.is_authenticated()
    return {"authenticated": is_auth}


@app.get("/api/calendar/auth")
async def calendar_auth(redirect_uri: str):
    """Get Google Calendar OAuth URL."""
    try:
        auth_url = calendar_service.get_auth_url(redirect_uri)
        return {"auth_url": auth_url}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/calendar/callback")
async def calendar_callback(code: str, redirect_uri: str):
    """Handle OAuth callback."""
    success = await calendar_service.handle_oauth_callback(code, redirect_uri)
    if success:
        return {"status": "authenticated"}
    raise HTTPException(status_code=400, detail="Authentication failed")


@app.get("/api/calendar/slots")
async def get_available_slots(
    days_ahead: int = Query(7, ge=1, le=30),
    duration: int = Query(30, ge=15, le=120),
):
    """Get available time slots for booking."""
    try:
        start = datetime.now()
        end = start + timedelta(days=days_ahead)
        slots = await calendar_service.get_available_slots(
            start, end, duration_minutes=duration
        )
        return {"slots": slots}
    except Exception as e:
        logger.error(f"Get slots error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/calendar/book")
async def book_meeting(
    title: str = Form(...),
    start_time: str = Form(...),
    duration_minutes: int = Form(30),
    attendee_email: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
):
    """Book a calendar event (coffee chat)."""
    try:
        start = datetime.fromisoformat(start_time)
        end = start + timedelta(minutes=duration_minutes)

        event = await calendar_service.create_event(
            title=title,
            start_time=start,
            end_time=end,
            description=description,
            attendee_email=attendee_email,
        )

        return {"status": "booked", "event": event}
    except Exception as e:
        logger.error(f"Book meeting error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/calendar/events")
async def get_upcoming_events(limit: int = 10):
    """Get upcoming calendar events."""
    try:
        events = await calendar_service.get_upcoming_events(limit)
        return {"events": events}
    except Exception as e:
        logger.error(f"Get events error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/calendar/events/{event_id}")
async def delete_event(event_id: str):
    """Delete a calendar event."""
    success = await calendar_service.delete_event(event_id)
    if success:
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="Event not found")


@app.post("/api/calendar/disconnect")
async def disconnect_calendar():
    """Disconnect Google Calendar."""
    await calendar_service.disconnect()
    return {"status": "disconnected"}


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
