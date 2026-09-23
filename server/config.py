import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# Default to gemini-2.0-flash-exp for Live Multimodal Audio, fallback to gemini-2.0-flash / gemini-1.5-flash
GEMINI_LIVE_MODEL = os.getenv("GEMINI_LIVE_MODEL", "gemini-2.0-flash-exp")
GEMINI_CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-2.0-flash")

# Voice options for Gemini Multimodal Live: Aoede, Charon, Fenrir, Kore, Puck
VOICE_NAME = os.getenv("VOICE_NAME", "Aoede")

PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")
