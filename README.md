# Chloe Doppelganger

3D 아바타 기반 AI 도플갱어(디지털 분신) 시스템

## 아키텍처

```
┌─────────────────── Unity (6000.2.10f1) ───────────────────┐
│  Voice Command ──► Avatar ──► Voice                       │
│       │              │           │                        │
│   Whisper(STT)   Agent Framework  ElevenLabs(TTS)        │
│                  (Agent, VectorDB)                        │
└───────────────────────┬───────────────────────────────────┘
                        │ HTTP/WebSocket
┌───────────────────────▼───────────────────────────────────┐
│                  Python Backend                            │
│   NeuroSync(Lipsync)  ◄──►  Ollama(LLM, VLM, Embedding)   │
│                       ◄──►  FAISS(VectorDB)               │
└───────────────────────────────────────────────────────────┘
```

## 기술 스택

| 컴포넌트 | 기술 |
|---------|------|
| **프론트엔드** | Unity 6000.2.10f1 |
| **백엔드** | Python + FastAPI |
| **STT** | Whisper |
| **TTS** | ElevenLabs |
| **LLM** | Ollama (llama3.2) |
| **Embedding** | qwen3-embedding:4b (2560 dim) |
| **VectorDB** | FAISS |
| **LipSync** | NeuroSync |
| **Avatar** | ARKit 52 Blendshapes |

## 프로젝트 구조

```
chloe-doppelganger/
├── python-backend/
│   ├── config/
│   │   └── settings.py
│   ├── src/
│   │   ├── api/
│   │   │   └── main.py          # FastAPI 메인 서버
│   │   ├── services/
│   │   │   ├── ollama_service.py
│   │   │   ├── elevenlabs_service.py
│   │   │   ├── neurosync_service.py
│   │   │   └── vector_db_service.py
│   │   └── models/
│   │       └── schemas.py
│   ├── requirements.txt
│   └── .env.example
│
└── unity-project/
    └── Assets/
        └── Scripts/
            ├── Agent/
            │   ├── AgentWorkflowManager.cs
            │   └── ApiClient.cs
            ├── Avatar/
            │   ├── AvatarController.cs
            │   └── ARKitBlendshapes.cs
            ├── Voice/
            │   ├── VoiceInputHandler.cs
            │   └── WebcamCapture.cs
            └── UI/
                └── DoppelgangerUI.cs
```

## 설치 및 실행

### 1. Python 백엔드 설정

```bash
cd python-backend

# 가상환경 생성
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경변수 설정
cp .env.example .env
# .env 파일에서 ELEVENLABS_API_KEY 등 설정

# Ollama 실행 (별도 터미널)
ollama serve
ollama pull llama3.2
ollama pull qwen3-embedding:4b

# 서버 실행
python -m src.api.main
```

### 2. Unity 프로젝트 설정

1. Unity Hub에서 Unity 6000.2.10f1 설치
2. `unity-project` 폴더를 Unity로 열기
3. 필요한 패키지 설치:
   - TextMeshPro
   - Newtonsoft JSON (선택)
4. 씬 설정 및 컴포넌트 연결

### 3. 아바타 준비

**ChatAvatar 사용 (권장)**
1. https://hyper3d.ai/chatavatar 접속
2. 얼굴 사진 업로드하여 3D 아바타 생성
3. FBX 파일 다운로드
4. Unity로 임포트

**또는 Unity Asset Store에서 다운로드**

## API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/health` | GET | 서비스 상태 확인 |
| `/api/chat` | POST | 채팅 (텍스트 + 오디오 + 립싱크) |
| `/api/tts` | POST | 텍스트 → 음성 변환 |
| `/api/lipsync` | POST | 오디오 → 블렌드쉐이프 |
| `/api/embedding` | POST | 텍스트 임베딩 생성 |
| `/api/documents` | POST | RAG 문서 추가 |
| `/api/rag/query` | POST | RAG 검색 |
| `/ws/chat` | WebSocket | 스트리밍 채팅 |

## ElevenLabs 음성 복제

1. https://elevenlabs.io/ 가입
2. Voice Lab에서 "Add Voice" → "Instant Voice Cloning"
3. 자신의 음성 샘플 업로드 (30초~1분)
4. 생성된 Voice ID를 `.env`에 설정

## 환경 변수

```env
# ElevenLabs (필수)
ELEVENLABS_API_KEY=your_api_key
ELEVENLABS_VOICE_ID=your_cloned_voice_id

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
OLLAMA_EMBEDDING_MODEL=qwen3-embedding:4b

# Server
HOST=0.0.0.0
PORT=8000
```

## 라이선스

MIT License
