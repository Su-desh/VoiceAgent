# 🪔 Shubh Diwali 2026 - AI Voice Sales & Gifting Concierge

An impressive, full-stack **Conversational AI Voice Sales Agent** built for the Diwali festive season. Featuring **Aarav**, an AI sales concierge who speaks warm festive English, dynamically analyzes gifting needs, showcases luxury products on screen in real time, handles objections, applies promo coupons, and drives high-conversion checkouts.

---

## ✨ Key Features & Client "Wow" Factors

1. **Dual Voice Architecture (Zero-Failure Guarantee)**:
   - **Gemini 2.0 Multimodal Live Audio**: Bidirectional speech-to-speech with Google AI Studio's Gemini 2.0 Flash over WebSockets with native interruptibility and real-time tool calling.
   - **Instant Fail-Safe Voice Pipeline**: Intelligent Web Speech + Speech Synthesis fallback that ensures 100% demo reliability even on unstable internet or without an immediate API key.

2. **Real-Time Voice + Visual Synchronization**:
   - As Aarav speaks about a specific hamper, the screen **smoothly scrolls and spotlights** that product with an animated golden ring.
   - Adding items to the cart or applying coupons immediately triggers **confetti bursts** and updates the live pricing breakdown.

3. **Interactive Golden Diya Audio Visualizer**:
   - Custom HTML5 Canvas visualizer that animates golden particle sparks and expanding sonic rings synchronized to voice frequencies.

4. **Festive Sales & Gifting Logic**:
   - **Gifting Persona Discovery**: Tailored recommendations for corporate VIPs, family elders, colleagues, and pooja blessings.
   - **Tiered Festive Perks**: Progress bar unlocking a *Complimentary Brass Diya Set* on orders above ₹1,999.
   - **Active Coupons**: `DIWALI20` (20% off), `SHUBH10` (10% off), and `LAKSHMI500` (₹500 off).
   - **Pincode Delivery Verification**: Express pre-Diwali delivery ETA calculation for Indian postal codes.

---

## 🏗️ Architecture

```
                       ┌────────────────────────────────────────┐
                       │   Next.js 16 (React + Tailwind CSS)    │
                       │  - Golden Diya Canvas Visualizer       │
                       │  - Dynamic Product Spotlight Grid      │
                       │  - Slide-out Festive Cart Drawer       │
                       │  - Live Subtitles / Dialogue History   │
                       └───────────────────▲────────────────────┘
                                           │ WebSocket / REST
                                           ▼
                       ┌────────────────────────────────────────┐
                       │     FastAPI Orchestrator Server        │
                       │  - /ws/live (Gemini Live Audio Bridge) │
                       │  - /api/catalog & /api/coupons         │
                       │  - Tool Calling & Cart Session Manager │
                       └───────────────────▲────────────────────┘
                                           │
                                           ▼
                       ┌────────────────────────────────────────┐
                       │     Google AI Studio (Gemini)          │
                       │  - Gemini 2.0 Flash Live Multimodal    │
                       │  - Spoken English Voice (Aoede/Puck)   │
                       │  - Function Calling & Sales Prompts    │
                       └────────────────────────────────────────┘
```

---

## 🚀 Quick Start (One-Click Launch)

### 1. Configure Gemini API Key (Optional but recommended)
Open `server/.env` and add your Google AI Studio API key:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```
*(You can get a free key from [https://aistudio.google.com/](https://aistudio.google.com/). Even without a key, the agent runs in full smart-demo mode!)*

### 2. Launch Both Backend & Frontend
Run the unified launch script from the project root:
```bash
cd /home/su-desh/Desktop/diwali-voice-agent
./run.sh
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🎤 Client Presentation Demo Script (Step-by-Step)

Follow this flow during your demo to showcase the agent's full sales capabilities:

| Step | Action / Speech | What Happens on Screen |
| :--- | :--- | :--- |
| **1. Greeting** | Click **"Tap to Speak to Aarav"** and say:<br/>*"Hello Aarav, I need some Diwali gifts!"* | Diya visualizer pulses with golden light; Aarav greets you warmly and asks who you are shopping for. |
| **2. Discovery** | Speak or click the **Corporate Gifting** demo chip:<br/>*"I need luxury corporate hampers under ₹3,000 for VIP clients."* | Screen smoothly scrolls and **spotlights the Grand Celebration Corporate Hamper** (₹2,899) in a royal velvet trunk. |
| **3. Upselling & Cart** | Speak or click the **20% Festive Coupon** demo chip:<br/>*"Add 2 Royal Dry Fruit Boxes and apply coupon DIWALI20."* | Cart drawer slides out showing 2 items (₹2,998), unlocks the **Free Brass Diya Gift**, applies 20% discount (saves ₹600), and fires **confetti**! |
| **4. Logistics Check** | Speak or click the **Pre-Diwali Delivery** chip:<br/>*"Can you guarantee delivery before Diwali to pincode 400001?"* | Aarav confirms **Metro Express 24-48 hr shipping** before Diwali with insured festive packaging. |
| **5. Checkout** | Click **"Proceed to Diwali Checkout"** in the cart. | Displays instant UPI QR code and payment simulator; triggers festive celebration modal! |

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Lucide React, Canvas Confetti, Web Audio API.
- **Backend**: Python 3.12, FastAPI, Uvicorn, WebSockets, Pydantic, python-dotenv.
- **AI Engine**: Google AI Studio Gemini 2.0 Multimodal Live API (`gemini-2.0-flash-exp`) & Gemini 2.0 Flash.
