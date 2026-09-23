import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# Best native live audio model on Google AI Studio
GEMINI_LIVE_MODEL = os.getenv("GEMINI_LIVE_MODEL", "gemini-2.5-flash-native-audio-latest")
# Best conversational fast chat model
GEMINI_CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-3.6-flash")

# Voice options for Gemini Multimodal Live: Aoede, Charon, Fenrir, Kore, Puck
VOICE_NAME = os.getenv("VOICE_NAME", "Aoede")

PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")
