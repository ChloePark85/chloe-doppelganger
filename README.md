# Coffeechat with Chloe

3D 아바타 기반 AI 도플갱어와 대화하고 커피챗을 예약하는 웹 애플리케이션

## 아키텍처

```
┌─────────────── Web Frontend (Next.js) ───────────────┐
│  Three.js + GLB ──► 3D Avatar                        │
│  Web Speech API ──► 음성 입력                         │
│  Web Audio API ──► 음성 재생 + LipSync               │
└──────────────────────┬───────────────────────────────┘
                       │ HTTP/WebSocket
┌──────────────────────▼───────────────────────────────┐
│                  Python Backend                       │
│   Ollama (LLM, Embedding)                            │
│   ElevenLabs (TTS, Voice Cloning)                    │
│   NeuroSync (LipSync → ARKit Blendshapes)            │
│   FAISS (VectorDB for RAG)                           │
└──────────────────────────────────────────────────────┘
```

## 기술 스택

| 컴포넌트 | 기술 |
|---------|------|
| **프론트엔드** | Next.js 14 + React + TypeScript |
| **3D 렌더링** | Three.js + React Three Fiber |
| **상태관리** | Zustand |
| **스타일링** | Tailwind CSS |
| **백엔드** | Python + FastAPI |
| **STT** | Web Speech API (브라우저 내장) |
| **TTS** | ElevenLabs (Voice Cloning) |
| **LLM** | Ollama (llama3.2) |
| **Embedding** | qwen3-embedding:4b (2560 dim) |
| **VectorDB** | FAISS |
| **LipSync** | NeuroSync (ARKit 52 Blendshapes) |

## 주요 기능

### 1. 페르소나 설정
- 이름, 직업, 소개 설정
- 말투 (친근/격식/편한/전문적)
- 존댓말/반말 선택
- 유머 수준 조절
- 전문 분야 및 관심사 설정

### 2. 지식 관리 (RAG)
- PDF, TXT, DOCX, MD 파일 업로드
- 자동 청킹 및 임베딩
- 대화 시 관련 지식 자동 참조

### 3. 메모리 시스템
- 사실 정보 저장 (생일, 연락처, 선호도 등)
- 대화 기록 저장
- 장기 메모리 기반 응답

### 4. Google Calendar 연동
- OAuth 인증
- 빈 시간 자동 확인
- 커피챗 일정 예약

## 프로젝트 구조

```
chloe-doppelganger/
├── python-backend/
│   ├── config/settings.py
│   ├── src/
│   │   ├── api/main.py              # FastAPI 서버
│   │   ├── services/
│   │   │   ├── ollama_service.py    # LLM + Embedding
│   │   │   ├── elevenlabs_service.py # TTS
│   │   │   ├── neurosync_service.py  # LipSync
│   │   │   ├── vector_db_service.py  # VectorDB
│   │   │   ├── document_service.py   # 문서 파싱
│   │   │   ├── memory_service.py     # 메모리 관리
│   │   │   ├── persona_service.py    # 페르소나 설정
│   │   │   └── calendar_service.py   # Google Calendar
│   │   └── models/schemas.py
│   ├── requirements.txt
│   └── .env.example
│
└── web-frontend/
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx
    │   │   └── globals.css
    │   ├── components/
    │   │   ├── AvatarViewer.tsx     # Three.js 3D 뷰어
    │   │   ├── ChatPanel.tsx        # 채팅 UI
    │   │   ├── VoiceInput.tsx       # 음성 입력
    │   │   ├── StatusBar.tsx        # 상태 표시
    │   │   └── SettingsPanel.tsx    # 설정 패널
    │   ├── lib/
    │   │   ├── api.ts
    │   │   ├── store.ts
    │   │   └── utils.ts
    │   ├── hooks/useAudio.ts
    │   └── types/index.ts
    ├── package.json
    └── .env.example
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
# .env 파일 편집하여 ELEVENLABS_API_KEY 등 설정

# 서버 실행
python -m src.api.main
```

### 2. Ollama 설치 (로컬 PC에서)

```bash
# Mac
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows: https://ollama.com/download/windows 에서 다운로드

# 모델 다운로드
ollama pull llama3.2
ollama pull qwen3-embedding:4b

# 서버 실행
ollama serve
```

### 3. 웹 프론트엔드 설정

```bash
cd web-frontend

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env.local

# 개발 서버 실행
npm run dev
```

브라우저에서 http://localhost:3000 접속

### 4. 아바타 준비

**ChatAvatar 사용 (권장)**
1. https://hyper3d.ai/chatavatar 접속
2. 얼굴 사진 업로드하여 3D 아바타 생성
3. **FBX 파일 다운로드**
4. **Blender로 GLB 변환** (File → Export → glTF 2.0)
5. 웹앱에 GLB 파일 드래그 앤 드롭

**온라인 변환기 사용**
- https://products.aspose.app/3d/conversion/fbx-to-glb

## 사용 방법

1. 웹앱 접속 (http://localhost:3000)
2. GLB 아바타 파일을 왼쪽 3D 뷰어에 드래그 앤 드롭
3. 오른쪽 채팅창에서 텍스트 입력 또는 마이크 버튼으로 음성 입력
4. 도플갱어가 음성으로 응답하며 아바타가 립싱크 애니메이션 수행

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

## ElevenLabs 음성 복제 설정

1. https://elevenlabs.io/ 가입
2. Voice Lab → "Add Voice" → "Instant Voice Cloning"
3. 자신의 음성 샘플 업로드 (30초~1분)
4. 생성된 Voice ID를 `.env`에 설정

```env
ELEVENLABS_API_KEY=your_api_key
ELEVENLABS_VOICE_ID=your_cloned_voice_id
```

## 환경 변수

### Python Backend (.env)
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

### Web Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

## 브라우저 호환성

| 기능 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| 3D 렌더링 | ✅ | ✅ | ✅ | ✅ |
| 음성 입력 | ✅ | ⚠️ | ⚠️ | ✅ |
| 음성 재생 | ✅ | ✅ | ✅ | ✅ |

※ 음성 입력(Web Speech API)은 Chrome/Edge에서 가장 잘 작동합니다.

## 라이선스

MIT License
