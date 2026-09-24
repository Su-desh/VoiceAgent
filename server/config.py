import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from server directory and current directory
server_env = Path(__file__).resolve().parent / ".env"
if server_env.exists():
    load_dotenv(dotenv_path=server_env)
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# Best native live audio model on Google AI Studio
GEMINI_LIVE_MODEL = os.getenv("GEMINI_LIVE_MODEL", "gemini-2.5-flash-native-audio-latest")
# Best conversational fast chat model
GEMINI_CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-3.6-flash")

# Voice options for Gemini Multimodal Live (Puck is male, Aoede is female)
VOICE_NAME = os.getenv("VOICE_NAME", "Puck")

PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")
