import json
import logging
import os
from typing import Optional
import aiofiles

from config.settings import settings

logger = logging.getLogger(__name__)

PERSONA_FILE = os.path.join(settings.VECTOR_DB_PATH, "persona.json")


class PersonaService:
    """Service for managing the doppelganger's persona settings."""

    DEFAULT_PERSONA = {
        "name": "도플갱어",
        "description": "사용자의 디지털 분신입니다.",
        "personality": {
            "tone": "friendly",  # friendly, formal, casual, professional
            "humor": "moderate",  # none, subtle, moderate, high
            "verbosity": "balanced",  # concise, balanced, detailed
            "emoji_usage": "minimal",  # none, minimal, moderate, frequent
        },
        "background": {
            "occupation": "",
            "expertise": [],
            "interests": [],
            "education": "",
        },
        "communication": {
            "language": "ko",
            "honorific": "polite",  # casual, polite, formal
            "catchphrases": [],
            "avoided_topics": [],
        },
        "behavior": {
            "proactive": True,
            "ask_clarifying_questions": True,
            "remember_preferences": True,
            "suggest_calendar": True,
        },
    }

    def __init__(self):
        self.persona = self.DEFAULT_PERSONA.copy()
        self._loaded = False

    async def load(self):
        """Load persona from file."""
        if self._loaded:
            return

        os.makedirs(os.path.dirname(PERSONA_FILE), exist_ok=True)

        if os.path.exists(PERSONA_FILE):
            try:
                async with aiofiles.open(PERSONA_FILE, "r", encoding="utf-8") as f:
                    content = await f.read()
                    self.persona = json.loads(content)
                logger.info("Persona loaded from file")
            except Exception as e:
                logger.error(f"Failed to load persona: {e}")
                self.persona = self.DEFAULT_PERSONA.copy()
        else:
            await self.save()

        self._loaded = True

    async def save(self):
        """Save persona to file."""
        os.makedirs(os.path.dirname(PERSONA_FILE), exist_ok=True)

        try:
            async with aiofiles.open(PERSONA_FILE, "w", encoding="utf-8") as f:
                await f.write(json.dumps(self.persona, ensure_ascii=False, indent=2))
            logger.info("Persona saved to file")
        except Exception as e:
            logger.error(f"Failed to save persona: {e}")
            raise

    async def get_persona(self) -> dict:
        """Get current persona settings."""
        await self.load()
        return self.persona.copy()

    async def update_persona(self, updates: dict) -> dict:
        """Update persona settings."""
        await self.load()

        # Deep merge updates
        self._deep_merge(self.persona, updates)
        await self.save()

        return self.persona.copy()

    async def get_system_prompt(self) -> str:
        """Generate system prompt based on persona settings."""
        await self.load()

        p = self.persona
        personality = p.get("personality", {})
        background = p.get("background", {})
        communication = p.get("communication", {})
        behavior = p.get("behavior", {})

        # Build system prompt
        prompt_parts = [
            f"당신은 '{p.get('name', '도플갱어')}'입니다. {p.get('description', '')}",
        ]

        # Personality
        tone_map = {
            "friendly": "친근하고 따뜻하게",
            "formal": "격식을 갖추어 정중하게",
            "casual": "편하고 자연스럽게",
            "professional": "전문적이고 신뢰감 있게",
        }
        prompt_parts.append(
            f"말투: {tone_map.get(personality.get('tone', 'friendly'), '친근하게')} 대화합니다."
        )

        # Honorific
        honorific_map = {
            "casual": "반말을 사용합니다.",
            "polite": "존댓말을 사용합니다.",
            "formal": "높임말을 사용합니다.",
        }
        prompt_parts.append(honorific_map.get(communication.get("honorific", "polite"), ""))

        # Background
        if background.get("occupation"):
            prompt_parts.append(f"직업: {background['occupation']}")

        if background.get("expertise"):
            prompt_parts.append(f"전문 분야: {', '.join(background['expertise'])}")

        if background.get("interests"):
            prompt_parts.append(f"관심사: {', '.join(background['interests'])}")

        # Verbosity
        verbosity_map = {
            "concise": "답변은 간결하게 핵심만 전달합니다.",
            "balanced": "적절한 길이로 답변합니다.",
            "detailed": "상세하고 풍부한 설명을 제공합니다.",
        }
        prompt_parts.append(
            verbosity_map.get(personality.get("verbosity", "balanced"), "")
        )

        # Humor
        if personality.get("humor") in ["moderate", "high"]:
            prompt_parts.append("적절한 유머를 섞어 대화합니다.")

        # Catchphrases
        if communication.get("catchphrases"):
            prompt_parts.append(
                f"자주 쓰는 표현: {', '.join(communication['catchphrases'])}"
            )

        # Behavior
        if behavior.get("suggest_calendar"):
            prompt_parts.append(
                "대화 중 미팅이나 커피챗이 필요해 보이면 일정 예약을 제안합니다."
            )

        # Avoided topics
        if communication.get("avoided_topics"):
            prompt_parts.append(
                f"다음 주제는 피합니다: {', '.join(communication['avoided_topics'])}"
            )

        return "\n".join(filter(None, prompt_parts))

    def _deep_merge(self, base: dict, updates: dict):
        """Deep merge updates into base dict."""
        for key, value in updates.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                self._deep_merge(base[key], value)
            else:
                base[key] = value

    async def reset(self):
        """Reset persona to defaults."""
        self.persona = self.DEFAULT_PERSONA.copy()
        await self.save()


persona_service = PersonaService()
