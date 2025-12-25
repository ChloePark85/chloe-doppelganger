import io
import logging
from typing import Optional
import aiofiles
from pypdf import PdfReader
from docx import Document

logger = logging.getLogger(__name__)


class DocumentService:
    """Service for parsing and processing documents."""

    SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".docx", ".md"}

    async def parse_document(
        self,
        file_content: bytes,
        filename: str,
    ) -> str:
        """Parse document content based on file type."""
        ext = self._get_extension(filename)

        if ext == ".pdf":
            return await self._parse_pdf(file_content)
        elif ext == ".docx":
            return await self._parse_docx(file_content)
        elif ext in {".txt", ".md"}:
            return await self._parse_text(file_content)
        else:
            raise ValueError(f"Unsupported file type: {ext}")

    async def _parse_pdf(self, content: bytes) -> str:
        """Extract text from PDF."""
        try:
            reader = PdfReader(io.BytesIO(content))
            text_parts = []

            for page in reader.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)

            return "\n\n".join(text_parts)
        except Exception as e:
            logger.error(f"PDF parsing error: {e}")
            raise

    async def _parse_docx(self, content: bytes) -> str:
        """Extract text from DOCX."""
        try:
            doc = Document(io.BytesIO(content))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            return "\n\n".join(paragraphs)
        except Exception as e:
            logger.error(f"DOCX parsing error: {e}")
            raise

    async def _parse_text(self, content: bytes) -> str:
        """Extract text from plain text files."""
        try:
            return content.decode("utf-8")
        except UnicodeDecodeError:
            return content.decode("cp949", errors="ignore")

    def _get_extension(self, filename: str) -> str:
        """Get lowercase file extension."""
        if "." not in filename:
            return ""
        return "." + filename.rsplit(".", 1)[-1].lower()

    def chunk_text(
        self,
        text: str,
        chunk_size: int = 500,
        overlap: int = 50,
    ) -> list[str]:
        """Split text into overlapping chunks for RAG."""
        if not text:
            return []

        chunks = []
        start = 0

        while start < len(text):
            end = start + chunk_size

            # Try to break at sentence boundary
            if end < len(text):
                # Look for sentence end within last 100 chars
                search_start = max(end - 100, start)
                last_period = text.rfind(".", search_start, end)
                last_newline = text.rfind("\n", search_start, end)

                break_point = max(last_period, last_newline)
                if break_point > start:
                    end = break_point + 1

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            start = end - overlap

        return chunks


document_service = DocumentService()
