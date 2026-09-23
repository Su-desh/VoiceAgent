import asyncio
import json
import base64
import logging
from typing import Optional, Callable
import websockets
from config import GEMINI_API_KEY, GEMINI_LIVE_MODEL, VOICE_NAME
from prompts import SYSTEM_INSTRUCTION
from tools import GEMINI_TOOLS_DECLARATIONS, execute_tool

logger = logging.getLogger("gemini_live")
logger.setLevel(logging.INFO)

GEMINI_WS_URL = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key={GEMINI_API_KEY}"

class GeminiLiveBridge:
    def __init__(self, session_id: str, on_client_message: Callable[[dict], None]):
        self.session_id = session_id
        self.on_client_message = on_client_message
        self.gemini_ws: Optional[websockets.WebSocketClientProtocol] = None
        self.is_connected = False
        self._receive_task: Optional[asyncio.Task] = None

    async def connect(self) -> bool:
        if not GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY not configured. Gemini Live cannot connect directly.")
            return False

        try:
            url = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key={GEMINI_API_KEY}"
            self.gemini_ws = await websockets.connect(url)
            self.is_connected = True

            # Send initial setup packet
            setup_message = {
                "setup": {
                    "model": f"models/{GEMINI_LIVE_MODEL}",
                    "generationConfig": {
                        "responseModalities": ["AUDIO"],
                        "speechConfig": {
                            "voiceConfig": {
                                "prebuiltVoiceConfig": {
                                    "voiceName": VOICE_NAME
                                }
                            }
                        }
                    },
                    "systemInstruction": {
                        "parts": [{"text": SYSTEM_INSTRUCTION}]
                    },
                    "tools": [
                        {"functionDeclarations": GEMINI_TOOLS_DECLARATIONS}
                    ]
                }
            }
            await self.gemini_ws.send(json.dumps(setup_message))
            logger.info("Sent Gemini Live setup handshake.")

            # Start background listener task
            self._receive_task = asyncio.create_task(self._listen_to_gemini())
            return True
        except Exception as e:
            logger.error(f"Error connecting to Gemini Live WebSocket: {e}")
            self.is_connected = False
            return False

    async def send_audio_chunk(self, base64_pcm_16k: str):
        if not self.is_connected or not self.gemini_ws:
            return
        
        msg = {
            "realtimeInput": {
                "mediaChunks": [
                    {
                        "mimeType": "audio/pcm;rate=16000",
                        "data": base64_pcm_16k
                    }
                ]
            }
        }
        await self.gemini_ws.send(json.dumps(msg))

    async def send_user_text(self, text: str):
        if not self.is_connected or not self.gemini_ws:
            return
        
        msg = {
            "clientContent": {
                "turns": [
                    {
                        "role": "user",
                        "parts": [{"text": text}]
                    }
                ],
                "turnComplete": True
            }
        }
        await self.gemini_ws.send(json.dumps(msg))

    async def _listen_to_gemini(self):
        try:
            async for raw_message in self.gemini_ws:
                try:
                    data = json.loads(raw_message)
                except Exception:
                    continue

                # 1. Check for Audio / Model turn output
                server_content = data.get("serverContent")
                if server_content:
                    model_turn = server_content.get("modelTurn")
                    if model_turn:
                        for part in model_turn.get("parts", []):
                            inline_data = part.get("inlineData")
                            if inline_data and inline_data.get("mimeType", "").startswith("audio/pcm"):
                                await self.on_client_message({
                                    "type": "AUDIO_CHUNK",
                                    "data": inline_data.get("data"),
                                    "rate": 24000
                                })
                            if "text" in part and part["text"]:
                                await self.on_client_message({
                                    "type": "AGENT_TEXT",
                                    "text": part["text"]
                                })
                    
                    if server_content.get("interrupted"):
                        await self.on_client_message({
                            "type": "INTERRUPTED"
                        })

                    if server_content.get("turnComplete"):
                        await self.on_client_message({
                            "type": "TURN_COMPLETE"
                        })

                # 2. Check for Tool / Function Calls
                tool_call = data.get("toolCall")
                if tool_call:
                    function_calls = tool_call.get("functionCalls", [])
                    function_responses = []
                    for call in function_calls:
                        name = call.get("name")
                        args = call.get("args", {})
                        call_id = call.get("id")

                        # Execute tool
                        logger.info(f"Executing tool {name} with args {args}")
                        tool_res = execute_tool(name, args, self.session_id)

                        # Emit UI event to frontend immediately
                        if tool_res.get("ui_event"):
                            await self.on_client_message({
                                "type": "UI_EVENT",
                                "event": tool_res["ui_event"]
                            })

                        function_responses.append({
                            "response": {"output": tool_res.get("result", {})},
                            "id": call_id
                        })

                    # Send tool responses back to Gemini Live
                    resp_packet = {
                        "toolResponse": {
                            "functionResponses": function_responses
                        }
                    }
                    await self.gemini_ws.send(json.dumps(resp_packet))

        except websockets.ConnectionClosed:
            logger.info("Gemini Live connection closed.")
        except Exception as e:
            logger.error(f"Error in Gemini Live receiver: {e}")
        finally:
            self.is_connected = False

    async def close(self):
        self.is_connected = False
        if self._receive_task:
            self._receive_task.cancel()
        if self.gemini_ws:
            await self.gemini_ws.close()
