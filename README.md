# 🪔 Shubh Diwali 2026 - AI Voice Sales & Gifting Concierge

An interactive, production-ready **Conversational AI Voice Sales Agent** built for the Diwali festive shopping season. Powered by **Google AI Studio (Gemini 2.5 Native Live Audio & Gemini 3.6 Flash)** and **Next.js 16**, the agent warmly consults with shoppers in natural spoken English, spotlights luxury hampers on screen in real time, manages festive carts, calculates discounts, and secures orders.

---

## 🌟 Core Highlights & Client "Wow" Factors

1. **Continuous Hands-Free Conversation**:
   - Zero-click flow: The microphone stays open continuously (`continuous: true`). When Aarav finishes speaking, the microphone smoothly listens for your next follow-up.
   - Built-in natural silence debouncer (900ms) and `no-speech` auto-recovery so you can pause and think without the microphone cutting out.

2. **Real-Time Voice + Visual Synchronization**:
   - When Aarav discusses a specific gift, the screen **smoothly scrolls and spotlights that product** with a glowing golden border and active flame badge.
   - Applying coupon codes or unlocking gifts instantly triggers **celebratory confetti animations**.

3. **Interactive Golden Diya Audio Visualizer**:
   - HTML5 Canvas visualizer wired to your **live microphone volume input** via Web Audio API.
   - Dynamic voice activity indicator (*"Hearing your voice..."* vs. *"Listening... Speak anytime"*).

4. **Sample-Accurate Jitter Buffer & Keepalive Engine**:
   - Scheduled Web Audio playback clock prevents audio gaps, clicks, or stuttering.
   - Silent keepalive heartbeat sent every 12s prevents Google AI Studio from disconnecting due to inactivity.
   - High-frequency unfreeze watchdog timer guarantees the UI never locks in "speaking" or "thinking" state.

5. **Festive Gifting & Sales Features**:
   - **Gifting Discovery**: Tailored recommendations for corporate VIPs, family elders, colleagues, and pooja blessings.
   - **Tiered Festive Perks**: Orders over ₹1,999 automatically unlock a **Complimentary Peacock Brass Diya Set**.
   - **Promotional Coupons**: `DIWALI20` (20% off above ₹1,200), `SHUBH10` (10% off), `LAKSHMI500` (₹500 off).
   - **Logistics Verification**: 6-digit Indian postal code estimator for guaranteed pre-Diwali express delivery.

---

## 🏗️ System Architecture

```
                       ┌────────────────────────────────────────┐
                       │   Next.js 16 (React + Tailwind CSS)    │
                       │  - Golden Diya Canvas Visualizer       │
                       │  - Dynamic Product Spotlight Grid      │
                       │  - Continuous Hands-Free Speech Flow   │
                       │  - Slide-out Festive Cart & Checkout   │
                       └───────────────────▲────────────────────┘
                                           │ WebSocket / REST
                                           ▼
                       ┌────────────────────────────────────────┐
                       │     FastAPI Orchestrator Server        │
                       │  - /ws/live (Gemini Live Audio Bridge) │
                       │  - 12-second Silent Keepalive Loop     │
                       │  - Dynamic Auto-Reconnect & Fallback   │
                       │  - Tool Calling & Cart Session Manager │
                       └───────────────────▲────────────────────┘
                                           │
                                           ▼
                       ┌────────────────────────────────────────┐
                       │     Google AI Studio (Gemini)          │
                       │  - Primary: gemini-2.5-flash-native    │
                       │  - Secondary: gemini-3.6-flash         │
                       │  - Voice: Puck (Natural Male Voice)    │
                       │  - Real-time Function Calling          │
                       └────────────────────────────────────────┘
```

---

## 🚀 Quick Start (Local Run)

### 1. Prerequisites
- **Node.js** v18+ (tested on Node v24)
- **Python** 3.10+ (tested on Python 3.12)
- *(Optional)* Google AI Studio API Key from [aistudio.google.com](https://aistudio.google.com/)

### 2. Configuration
Copy `.env.example` to `server/.env` and add your Gemini API key:
```bash
cp server/.env.example server/.env
```
In `server/.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio-latest
GEMINI_CHAT_MODEL=gemini-3.6-flash
VOICE_NAME=Puck
PORT=8000
HOST=0.0.0.0
```
*(Even without an API key, the agent operates in full Smart-Demo Mode with built-in sales heuristics and speech synthesis!)*

### 3. Launch with One Command
```bash
cd /home/su-desh/Desktop/diwali-voice-agent
./run.sh
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 🌐 Production Deployment Guide

### Option A: Deploying Frontend to Vercel
1. Set the root directory to `client` in the Vercel dashboard.
2. Build Command: `npm run build`
3. Output Directory: `.next`
4. Set Environment Variable:
   ```env
   NEXT_PUBLIC_API_URL=https://your-backend-domain.com
   ```

### Option B: Deploying Backend to Railway / Render / Fly.io
1. Set the root directory to `server`.
2. Build Command: `pip install -r requirements.txt`
3. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Configure Environment Variables in the cloud dashboard:
   - `GEMINI_API_KEY`: Your Google AI Studio API key
   - `GEMINI_LIVE_MODEL`: `gemini-2.5-flash-native-audio-latest`
   - `GEMINI_CHAT_MODEL`: `gemini-3.6-flash`
   - `VOICE_NAME`: `Puck`

### Option C: Unified Docker Deployment
```dockerfile
# Backend Dockerfile example (server/Dockerfile)
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 🎤 Client Presentation Demo Script

Follow this step-by-step flow during meetings or video calls for maximum impact:

| Step | Action / What to Speak | What Happens on Screen |
| :--- | :--- | :--- |
| **1. Greeting** | Click **"Tap to Speak to Aarav"** once and say:<br/>*"Hello Aarav, I need some Diwali gifts!"* | The Diya visualizer dances to your voice; Aarav responds in a warm male voice and asks who you're shopping for. |
| **2. Discovery** | Speak naturally (no clicks needed):<br/>*"I'm looking for luxury corporate hampers under ₹3,000 for VIP clients."* | Screen smoothly scrolls and **spotlights the Grand Celebration Corporate Hamper** (₹2,899) in a royal midnight blue velvet trunk. |
| **3. Upselling & Cart** | Speak naturally:<br/>*"Add 2 of those hampers to my cart and apply coupon DIWALI20."* | Cart drawer slides out (2 units: ₹5,798), **unlocks the Complimentary Brass Diya gift**, applies 20% discount (saves ₹1,000), and fires **confetti**! |
| **4. Logistics Check** | Speak naturally:<br/>*"Can you guarantee delivery before Diwali to pincode 400001?"* | Aarav confirms **Metro Express 24-48 hr shipping** before Diwali with insured festive packaging. |
| **5. Checkout** | Click **"Proceed to Diwali Checkout"** in the cart drawer. | Presents simulated instant UPI QR code and payment confirmation celebration modal. |

---

## 🧪 Testing & Verification

Run backend unit tests:
```bash
cd server
./venv/bin/pytest test_server.py
```
*(7 tests pass in 0.03s verifying catalog querying, discount calculation, free gifts, cart sessions, and pincode ETAs)*.

Build frontend:
```bash
cd client
npm run build
```
*(Compiles cleanly with 0 TypeScript warnings)*.

---

## 📂 Repository Structure

```
diwali-voice-agent/
├── AGENTS.md               # Detailed AI Agent specifications, tools & audio pipeline
├── README.md               # Master documentation & deployment guide
├── run.sh                  # One-click startup script for backend & frontend
├── .gitignore              # Ignores venv, node_modules, .next, .env
├── server/                 # Python FastAPI Backend
│   ├── main.py             # REST API & WebSocket Live Audio Bridge
│   ├── gemini_live.py      # Gemini 2.5 Live WebSocket client with keepalive
│   ├── chat_service.py     # Gemini 3.6 Flash conversational engine & fallback
│   ├── catalog.py          # Luxury Diwali products, coupons, delivery logic
│   ├── tools.py            # Gemini function declarations & cart state session
│   ├── prompts.py          # Aarav consultative sales persona instructions
│   ├── test_server.py      # Automated pytest suite
│   ├── requirements.txt    # Python dependencies
│   └── .env.example        # Environment variable template
└── client/                 # Next.js 16 Web Application
    ├── src/
    │   ├── app/            # Next.js App Router (layout.tsx, page.tsx, globals.css)
    │   ├── components/     # AudioVisualizer, ProductSpotlight, FestiveCart, LiveTranscript
    │   ├── hooks/          # useVoiceAgent (jitter buffer, continuous flow, mic volume)
    │   └── types/          # TypeScript interface definitions
    └── package.json        # Frontend dependencies
```

---

## 📄 License
MIT License. Created for the Shubh Diwali 2026 AI Showcase.
