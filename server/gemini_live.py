import asyncio
import base64
import logging
from typing import Optional, Callable
from google import genai
from google.genai import types
from config import GEMINI_API_KEY, GEMINI_LIVE_MODEL, VOICE_NAME
from prompts import SYSTEM_INSTRUCTION
from tools import GEMINI_TOOLS_DECLARATIONS, execute_tool

logger = logging.getLogger("gemini_live")
logger.setLevel(logging.INFO)

class GeminiLiveBridge:
    def __init__(self, session_id: str, on_client_message: Callable[[dict], None]):
        self.session_id = session_id
        self.on_client_message = on_client_message
        self.client: Optional[genai.Client] = None
        self._session_ctx = None
        self.session = None
        self.is_connected = False
        self._receive_task: Optional[asyncio.Task] = None
        self._is_closing = False
        self._lock = asyncio.Lock()

    async def connect(self) -> bool:
        if not GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY not configured. Gemini Live cannot connect directly.")
            return False

        async with self._lock:
            if self.is_connected and self.session:
                return True

            try:
                self._is_closing = False
                self.client = genai.Client(api_key=GEMINI_API_KEY)
                
                # Setup live connection config with audio response and transcription
                config = types.LiveConnectConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE_NAME)
                        )
                    ),
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                    output_audio_transcription=types.AudioTranscriptionConfig(),
                    system_instruction=types.Content(parts=[types.Part.from_text(text=SYSTEM_INSTRUCTION)]),
                    tools=[types.Tool(function_declarations=GEMINI_TOOLS_DECLARATIONS)]
                )

                model_name = GEMINI_LIVE_MODEL
                if not model_name.startswith("models/"):
                    model_name = f"models/{model_name}"

                self._session_ctx = self.client.aio.live.connect(model=model_name, config=config)
                self.session = await self._session_ctx.__aenter__()
                self.is_connected = True
                logger.info(f"Gemini Live session connected successfully for session {self.session_id}")

                if self._receive_task and not self._receive_task.done():
                    self._receive_task.cancel()

                self._receive_task = asyncio.create_task(self._listen_to_gemini())
                return True
            except Exception as e:
                logger.error(f"Error connecting to Gemini Live: {e}")
                self.is_connected = False
                self.session = None
                return False

    async def reset(self):
        """Cleanly closes existing live connection and starts a fresh one."""
        await self.close()
        return await self.connect()

    async def send_user_text(self, text: str) -> bool:
        if not self.is_connected or not self.session:
            connected = await self.connect()
            if not connected or not self.session:
                return False

        try:
            await self.session.send_client_content(
                turns=[types.Content(role="user", parts=[types.Part.from_text(text=text)])],
                turn_complete=True
            )
            return True
        except Exception as e:
            logger.warning(f"Error sending user text to Gemini Live: {e}, attempting reconnect...")
            self.is_connected = False
            try:
                if await self.connect():
                    await self.session.send_client_content(
                        turns=[types.Content(role="user", parts=[types.Part.from_text(text=text)])],
                        turn_complete=True
                    )
                    return True
            except Exception as e2:
                logger.error(f"Failed to send user text after reconnect: {e2}")
            return False

    async def _listen_to_gemini(self):
        full_transcript = []
        try:
            async for response in self.session.receive():
                if self._is_closing:
                    break

                # 1. Handle Tool Calls
                if response.tool_call:
                    function_calls = response.tool_call.function_calls or []
                    function_responses = []
                    for call in function_calls:
                        name = call.name
                        args = call.args or {}
                        call_id = call.id
                        logger.info(f"Gemini Live tool call: {name} args={args}")

                        tool_res = execute_tool(name, args, self.session_id)
                        if tool_res.get("ui_event"):
                            await self.on_client_message({
                                "type": "UI_EVENT",
                                "event": tool_res["ui_event"]
                            })

                        function_responses.append(
                            types.FunctionResponse(
                                name=name,
                                id=call_id,
                                response={"result": tool_res.get("result", {})}
                            )
                        )

                    if function_responses:
                        try:
                            await self.session.send_tool_response(function_responses=function_responses)
                        except Exception as e:
                            logger.error(f"Error sending tool responses: {e}")

                # 2. Handle Server Content (Audio & Transcription)
                sc = response.server_content
                if sc:
                    if sc.model_turn:
                        for part in sc.model_turn.parts:
                            if part.inline_data and part.inline_data.data:
                                b64_audio = base64.b64encode(part.inline_data.data).decode("utf-8")
                                await self.on_client_message({
                                    "type": "AUDIO_CHUNK",
                                    "data": b64_audio,
                                    "rate": 24000
                                })
                            # Check if non-thought text part exists
                            if not getattr(part, "thought", False) and getattr(part, "text", None):
                                await self.on_client_message({
                                    "type": "AGENT_TEXT_CHUNK",
                                    "text": part.text
                                })
                                full_transcript.append(part.text)

                    if sc.output_transcription and sc.output_transcription.text:
                        text_chunk = sc.output_transcription.text
                        await self.on_client_message({
                            "type": "AGENT_TEXT_CHUNK",
                            "text": text_chunk
                        })
                        full_transcript.append(text_chunk)

                    if sc.interrupted:
                        full_transcript.clear()
                        await self.on_client_message({
                            "type": "INTERRUPTED"
                        })

                    if sc.turn_complete:
                        final_text = "".join(full_transcript).strip()
                        full_transcript.clear()
                        await self.on_client_message({
                            "type": "TURN_COMPLETE",
                            "text": final_text
                        })

        except asyncio.CancelledError:
            pass
        except Exception as e:
            if not self._is_closing:
                logger.error(f"Exception in Gemini Live receive loop: {e}")
        finally:
            self.is_connected = False
            if not self._is_closing:
                try:
                    await self.on_client_message({"type": "TURN_COMPLETE"})
                except Exception:
                    pass

    async def close(self):
        self._is_closing = True
        self.is_connected = False
        if self._receive_task and not self._receive_task.done():
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
            except Exception:
                pass
            self._receive_task = None

        if self._session_ctx:
            try:
                await self._session_ctx.__aexit__(None, None, None)
            except Exception:
                pass
            self._session_ctx = None
            self.session = None
