import json
import logging
import os
from datetime import datetime, timedelta
from typing import Optional
import aiofiles

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from config.settings import settings

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar"]
CREDENTIALS_FILE = os.path.join(settings.VECTOR_DB_PATH, "google_credentials.json")
TOKEN_FILE = os.path.join(settings.VECTOR_DB_PATH, "google_token.json")


class CalendarService:
    """Service for Google Calendar integration."""

    def __init__(self):
        self.credentials: Optional[Credentials] = None
        self._service = None

    async def is_authenticated(self) -> bool:
        """Check if user is authenticated with Google."""
        if os.path.exists(TOKEN_FILE):
            try:
                async with aiofiles.open(TOKEN_FILE, "r") as f:
                    token_data = json.loads(await f.read())
                self.credentials = Credentials.from_authorized_user_info(token_data, SCOPES)
                return self.credentials.valid
            except Exception:
                return False
        return False

    def get_auth_url(self, redirect_uri: str) -> str:
        """Get OAuth authorization URL."""
        if not os.path.exists(CREDENTIALS_FILE):
            raise ValueError(
                "Google credentials not configured. "
                "Please add google_credentials.json to the data folder."
            )

        flow = Flow.from_client_secrets_file(
            CREDENTIALS_FILE,
            scopes=SCOPES,
            redirect_uri=redirect_uri,
        )

        auth_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
        )

        return auth_url

    async def handle_oauth_callback(
        self,
        authorization_code: str,
        redirect_uri: str,
    ) -> bool:
        """Handle OAuth callback and save credentials."""
        try:
            flow = Flow.from_client_secrets_file(
                CREDENTIALS_FILE,
                scopes=SCOPES,
                redirect_uri=redirect_uri,
            )

            flow.fetch_token(code=authorization_code)
            self.credentials = flow.credentials

            # Save token
            os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)
            async with aiofiles.open(TOKEN_FILE, "w") as f:
                await f.write(self.credentials.to_json())

            logger.info("Google Calendar authenticated successfully")
            return True

        except Exception as e:
            logger.error(f"OAuth callback error: {e}")
            return False

    def _get_service(self):
        """Get Google Calendar service."""
        if not self.credentials:
            raise ValueError("Not authenticated with Google Calendar")

        if not self._service:
            self._service = build("calendar", "v3", credentials=self.credentials)

        return self._service

    async def get_available_slots(
        self,
        start_date: datetime,
        end_date: datetime,
        duration_minutes: int = 30,
        working_hours: tuple[int, int] = (9, 18),
    ) -> list[dict]:
        """Get available time slots for scheduling."""
        try:
            service = self._get_service()

            # Get busy times
            body = {
                "timeMin": start_date.isoformat() + "Z",
                "timeMax": end_date.isoformat() + "Z",
                "items": [{"id": "primary"}],
            }

            events_result = service.freebusy().query(body=body).execute()
            busy_times = events_result.get("calendars", {}).get("primary", {}).get("busy", [])

            # Convert to datetime objects
            busy_periods = []
            for busy in busy_times:
                start = datetime.fromisoformat(busy["start"].replace("Z", "+00:00"))
                end = datetime.fromisoformat(busy["end"].replace("Z", "+00:00"))
                busy_periods.append((start, end))

            # Find available slots
            available_slots = []
            current = start_date.replace(
                hour=working_hours[0], minute=0, second=0, microsecond=0
            )

            while current < end_date:
                # Skip weekends
                if current.weekday() >= 5:
                    current += timedelta(days=1)
                    current = current.replace(hour=working_hours[0], minute=0)
                    continue

                # Check if within working hours
                if current.hour >= working_hours[1]:
                    current += timedelta(days=1)
                    current = current.replace(hour=working_hours[0], minute=0)
                    continue

                if current.hour < working_hours[0]:
                    current = current.replace(hour=working_hours[0], minute=0)
                    continue

                slot_end = current + timedelta(minutes=duration_minutes)

                # Check if slot conflicts with busy times
                is_available = True
                for busy_start, busy_end in busy_periods:
                    if not (slot_end <= busy_start or current >= busy_end):
                        is_available = False
                        break

                if is_available:
                    available_slots.append({
                        "start": current.isoformat(),
                        "end": slot_end.isoformat(),
                        "display": current.strftime("%Y-%m-%d %H:%M"),
                    })

                current += timedelta(minutes=30)  # Check every 30 minutes

            return available_slots[:20]  # Return max 20 slots

        except HttpError as e:
            logger.error(f"Calendar API error: {e}")
            raise

    async def create_event(
        self,
        title: str,
        start_time: datetime,
        end_time: datetime,
        description: Optional[str] = None,
        attendee_email: Optional[str] = None,
        location: Optional[str] = None,
        send_notifications: bool = True,
    ) -> dict:
        """Create a calendar event."""
        try:
            service = self._get_service()

            event = {
                "summary": title,
                "start": {
                    "dateTime": start_time.isoformat(),
                    "timeZone": "Asia/Seoul",
                },
                "end": {
                    "dateTime": end_time.isoformat(),
                    "timeZone": "Asia/Seoul",
                },
            }

            if description:
                event["description"] = description

            if location:
                event["location"] = location

            if attendee_email:
                event["attendees"] = [{"email": attendee_email}]

            created_event = service.events().insert(
                calendarId="primary",
                body=event,
                sendUpdates="all" if send_notifications else "none",
            ).execute()

            logger.info(f"Created calendar event: {created_event.get('id')}")

            return {
                "id": created_event.get("id"),
                "title": created_event.get("summary"),
                "start": created_event.get("start", {}).get("dateTime"),
                "end": created_event.get("end", {}).get("dateTime"),
                "link": created_event.get("htmlLink"),
            }

        except HttpError as e:
            logger.error(f"Create event error: {e}")
            raise

    async def get_upcoming_events(self, max_results: int = 10) -> list[dict]:
        """Get upcoming calendar events."""
        try:
            service = self._get_service()

            now = datetime.utcnow().isoformat() + "Z"
            events_result = (
                service.events()
                .list(
                    calendarId="primary",
                    timeMin=now,
                    maxResults=max_results,
                    singleEvents=True,
                    orderBy="startTime",
                )
                .execute()
            )

            events = events_result.get("items", [])

            return [
                {
                    "id": event.get("id"),
                    "title": event.get("summary"),
                    "start": event.get("start", {}).get("dateTime")
                    or event.get("start", {}).get("date"),
                    "end": event.get("end", {}).get("dateTime")
                    or event.get("end", {}).get("date"),
                    "location": event.get("location"),
                    "link": event.get("htmlLink"),
                }
                for event in events
            ]

        except HttpError as e:
            logger.error(f"Get events error: {e}")
            raise

    async def delete_event(self, event_id: str) -> bool:
        """Delete a calendar event."""
        try:
            service = self._get_service()
            service.events().delete(calendarId="primary", eventId=event_id).execute()
            logger.info(f"Deleted calendar event: {event_id}")
            return True
        except HttpError as e:
            logger.error(f"Delete event error: {e}")
            return False

    async def disconnect(self):
        """Remove Google Calendar connection."""
        if os.path.exists(TOKEN_FILE):
            os.remove(TOKEN_FILE)
        self.credentials = None
        self._service = None
        logger.info("Google Calendar disconnected")


calendar_service = CalendarService()
