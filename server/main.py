import json
import logging
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import HOST, PORT, GEMINI_API_KEY
from catalog import PRODUCTS, COUPONS, get_all_products, get_product_by_id
from tools import get_session, reset_session, execute_tool
from gemini_live import GeminiLiveBridge
from chat_service import chat_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("server")

app = FastAPI(title="Diwali Voice Sales Agent API", version="1.0.0")

# Enable CORS for Next.js frontend (default port 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default"
    history: Optional[List[Dict[str, Any]]] = []

class ActionRequest(BaseModel):
    tool: str
    args: Dict[str, Any]
    session_id: Optional[str] = "default"

class ResetRequest(BaseModel):
    session_id: Optional[str] = "default"

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Shubh Diwali AI Voice Sales Agent",
        "docs": "/docs",
        "health": "/health",
        "catalog": "/api/catalog"
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "gemini_api_configured": bool(GEMINI_API_KEY),
        "catalog_items_count": len(PRODUCTS)
    }

@app.get("/api/catalog")
def get_catalog():
    return {
        "products": PRODUCTS,
        "festive_banner": {
            "title": "Grand Diwali Mahotsav 2026",
            "tagline": "Handcrafted Luxury, Auspicious Traditions & Guaranteed Pre-Diwali Delivery",
            "offer_highlight": "Use code DIWALI20 for 20% off + Free Brass Diya on orders over ₹1,999"
        }
    }

@app.get("/api/coupons")
def get_coupons():
    return {"coupons": COUPONS}

@app.get("/api/cart/{session_id}")
def get_cart_state(session_id: str):
    session = get_session(session_id)
    return session.get_summary()

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    result = await chat_service.handle_message(
        message=req.message,
        session_id=req.session_id,
        history=req.history
    )
    return result

@app.post("/api/action")
def action_endpoint(req: ActionRequest):
    res = execute_tool(req.tool, req.args, req.session_id)
    return res

@app.post("/api/session/reset")
def reset_session_endpoint(req: Optional[ResetRequest] = None):
    sid = req.session_id if req and req.session_id else "default"
    session = reset_session(sid)
    logger.info(f"Reset session '{sid}' to fresh empty state.")
    return {
        "success": True,
        "message": "Session reset successfully",
        "cart": session.get_summary()
    }

@app.websocket("/ws/live/{session_id}")
async def websocket_live_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    logger.info(f"Client connected to /ws/live/{session_id}")

    # Callback when Gemini Live sends data to forward to client
    async def forward_to_client(data: dict):
        try:
            await websocket.send_json(data)
        except Exception as e:
            logger.error(f"Error forwarding to client websocket: {e}")

    bridge = GeminiLiveBridge(session_id=session_id, on_client_message=forward_to_client)
    connected_to_gemini = await bridge.connect()

    if not connected_to_gemini:
        # Notify client that Gemini Live direct connection is unavailable (will use audio/REST fallback)
        await websocket.send_json({
            "type": "SYSTEM_INFO",
            "message": "Gemini Live direct connection not configured. Client will use seamless voice synthesis fallback.",
            "mode": "FALLBACK_AUDIO"
        })
    else:
        await websocket.send_json({
            "type": "SYSTEM_INFO",
            "message": "Connected to Gemini Live Multimodal Engine (Puck).",
            "mode": "GEMINI_LIVE"
        })

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                data = json.loads(raw_text)
            except Exception:
                continue

            msg_type = data.get("type")

            # 1. Incoming Audio Chunk from Client Microphone (16kHz PCM Base64)
            if msg_type == "AUDIO_INPUT":
                pcm_data = data.get("data")
                if pcm_data and connected_to_gemini:
                    await bridge.send_audio_chunk(pcm_data)

            # 2. Text message from user
            elif msg_type == "USER_TEXT":
                user_text = data.get("text", "")
                history = data.get("history", [])
                logger.info(f"Received USER_TEXT in session '{session_id}': {user_text}")
                sent_to_live = False

                if bridge.is_connected:
                    sent_to_live = await bridge.send_user_text(user_text)

                if not sent_to_live:
                    # Try to reconnect live bridge once
                    if await bridge.connect():
                        sent_to_live = await bridge.send_user_text(user_text)

                # If still not sent to live, seamlessly execute with high-speed chat_service
                if not sent_to_live:
                    logger.info("Using chat_service fallback for user query")
                    chat_res = await chat_service.handle_message(user_text, session_id=session_id, history=history)
                    await websocket.send_json({
                        "type": "AGENT_RESPONSE",
                        "text": chat_res["reply"],
                        "ui_events": chat_res["ui_events"],
                        "cart": chat_res["cart"]
                    })

            # 3. Direct Tool or action triggered from UI
            elif msg_type == "UI_TRIGGER":
                tool_name = data.get("tool")
                tool_args = data.get("args", {})
                res = execute_tool(tool_name, tool_args, session_id)
                await websocket.send_json({
                    "type": "TOOL_RESULT",
                    "result": res
                })

            # 4. Ping keepalive from frontend
            elif msg_type == "PING":
                await websocket.send_json({"type": "PONG"})

            # 5. Fresh Start / Reset session command
            elif msg_type == "RESET_SESSION":
                session = reset_session(session_id)
                await bridge.reset()
                await websocket.send_json({
                    "type": "SESSION_RESET",
                    "cart": session.get_summary()
                })
                logger.info(f"Session '{session_id}' freshly reset via WebSocket.")

    except WebSocketDisconnect:
        logger.info(f"Client disconnected from /ws/live/{session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await bridge.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
