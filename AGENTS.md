# 🤖 AGENTS.md - Aarav: AI Voice Sales & Gifting Concierge

This technical design document outlines the agent specifications, speech pipeline, tool declarations, state management, and fail-safe architecture for **Aarav**, the AI Voice Sales & Gifting Concierge.

---

## 1. Agent Persona & Behavioral Profile

- **Name**: Aarav
- **Role**: Senior Festive Sales & Gifting Concierge for the Grand Diwali Showcase 2026
- **Language**: Fluent English with warm, respectful Indian festive phrasing (*"Shubh Deepavali!", "Delighted to assist you"*).
- **Tone & Delivery**:
  - Hospitable, consultative, polite, and persuasive.
  - Spoken sentence length: 1 to 3 concise, natural sentences per turn (optimized for speech, avoiding lengthy bullet dumps or markdown tables).
- **Voice Profile**:
  - **Gemini Live Multimodal Voice**: `Puck` (warm, natural male voice).
  - **Web Speech Synthesis Fallback**: Filtered male English/Indian voices with a deeper, masculine pitch (`0.92`).
- **Core Directive**:
  1. Warmly discover the customer's gifting requirements (recipient, budget, sweet vs. dry fruit preference).
  2. Dynamically call `highlight_product` to spotlight items on screen in real time as they are discussed.
  3. Proactively call `add_to_cart` upon customer agreement.
  4. Offer and apply festive discounts (`DIWALI20`, `SHUBH10`, `LAKSHMI500`).
  5. Announce the *Complimentary Peacock Brass Diya* perk for orders exceeding ₹1,999.
  6. Verify guaranteed pre-Diwali express delivery using `check_delivery_pincode`.

---

## 2. Speech Subsystem & Dual Pipeline Architecture

```
                                [Browser Microphone]
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   ▼                                           ▼
       [Continuous Web Speech API]                  [Web Audio API Analyser]
    - continuous: true (no dropouts)             - Real-time frequency analysis
    - 900ms natural silence debouncer            - Drives Diya flame & golden rings
    - no-speech auto-recovery                    - Real-time "Hearing voice..." badge
                   │
                   ▼
       [FastAPI Orchestrator Server]
                   │
      ┌────────────┴────────────┐
      ▼                         ▼
[Primary: Gemini Live Audio]  [Secondary: Gemini 3.6 Flash + TTS]
- gemini-2.5-flash-native     - gemini-3.6-flash
- WebSocket BidiGenerate      - Structured Function Calling
- Sample-accurate jitter buf  - High-speed REST / WS fallback
- 12s silent keepalive ping   - 100% offline & unstable-net safe
```

### Key Subsystems:
1. **Sample-Accurate Web Audio Jitter Buffer**:
   - Eliminates gaps, clicks, and stuttering by scheduling incoming 24kHz PCM chunks against the Web Audio clock (`nextScheduledTime += buffer.duration`).
2. **Turn Completion Handshake**:
   - Microphones are paused while Aarav speaks to prevent acoustic echo feedback.
   - Listening only resumes when `TURN_COMPLETE` is confirmed **AND** all scheduled audio has finished playing + 350ms buffer.
3. **12-Second Silent Keepalive Heartbeat**:
   - Google AI Studio BidiGenerateContent times out after ~45s of audio silence.
   - A background server loop sends a 320-byte silent PCM frame every 12 seconds, preventing idle disconnects.
4. **Active Unfreeze Watchdog (400ms Interval)**:
   - If audio ends but state remains `speaking` for >2.5s, it automatically recovers to `idle`/`listening`.
   - If `thinking` state hangs for >7s without a response, it safely resets to `idle`.
   - Single tap on the visualizer immediately interrupts playback and re-engages the microphone.

---

## 3. Tool Declarations & Schema Reference

### `search_products`
- **Purpose**: Query catalog by category, budget constraints, or keywords.
- **Parameters**:
  - `category` (string, optional): `'hampers'`, `'sweets'`, `'dry-fruits'`, `'diyas'`, `'silver'`.
  - `max_budget` (number, optional): Maximum price in INR.
  - `min_budget` (number, optional): Minimum price in INR.
  - `query` (string, optional): Search keyword.
- **UI Event**: `FILTER_PRODUCTS`

### `highlight_product`
- **Purpose**: Spotlight and smoothly scroll to an item on the client's screen while discussing it.
- **Parameters**:
  - `product_id` (string, required): e.g. `'dw-01'`, `'dw-02'`, `'dw-03'`, `'dw-04'`, `'dw-05'`, `'dw-06'`.
- **UI Event**: `SPOTLIGHT_PRODUCT` (triggers animated golden ring and flame badge).

### `add_to_cart`
- **Purpose**: Add one or more units of a product to the user's festive cart.
- **Parameters**:
  - `product_id` (string, required): Product ID or name.
  - `quantity` (integer, optional, default: 1).
- **UI Event**: `CART_UPDATED` (updates cart drawer, subtotal, and free gift progress bar).

### `remove_from_cart`
- **Purpose**: Remove an item from the cart.
- **Parameters**:
  - `product_id` (string, required).
- **UI Event**: `CART_UPDATED`

### `apply_festive_coupon`
- **Purpose**: Validate and apply a promotional discount code.
- **Parameters**:
  - `coupon_code` (string, required): e.g. `'DIWALI20'` (20% off above ₹1,200), `'SHUBH10'` (10% off), `'LAKSHMI500'` (₹500 off on ₹2,500+).
- **UI Event**: `COUPON_APPLIED` (triggers celebratory confetti animation).

### `check_delivery_pincode`
- **Purpose**: Validate 6-digit Indian postal code and calculate guaranteed pre-Diwali delivery ETA.
- **Parameters**:
  - `pincode` (string, required): 6-digit postal code.
- **UI Event**: `PINCODE_CHECKED` (returns tier: Metro Express 24-48h vs. Standard Courier 2-3 days).

### `view_cart_and_checkout`
- **Purpose**: Open the slide-out cart drawer and display checkout summary with simulated UPI / Card options.
- **UI Event**: `OPEN_CHECKOUT`

---

## 4. Curated Catalog Manifest

| SKU | Product Name | Price | Category | Highlights |
| :--- | :--- | :--- | :--- | :--- |
| `dw-01` | **Royal Shahi Dry Fruit Box** | ₹1,499 | Dry Fruits | Californian almonds, Afghan pistachios, Goan cashews, Kashmiri walnuts. |
| `dw-02` | **Swarna Luxury Mithai & Brass Diya Hamper** | ₹2,199 | Sweets | Pure desi ghee Kaju Katli, Motichoor & Besan Ladoos + Peacock Brass Diya. |
| `dw-03` | **Anandam Handcrafted Terracotta Diya Set** | ₹799 | Diyas | Set of 6 organic soy wax scented terracotta diyas. Eco-friendly. |
| `dw-04` | **Grand Celebration Corporate Hamper** | ₹2,899 | Hampers | Executive midnight blue velvet trunk, Darjeeling first-flush tea, Belgian treats. |
| `dw-05` | **Shubh Lakshmi-Ganesh 999 Silver Coin Box** | ₹3,499 | Silver | 10g hallmarked 999 pure silver coin, Gangajal & pooja thali accessories. |
| `dw-06` | **Kesariya Saffron & Rose Sweet Platter** | ₹1,299 | Sweets | Saffron Peda & Rose Kaju Roll made with A2 Gir cow ghee & zero refined sugar. |

---

## 5. Session State Management

- **Session Store**: In-memory `CartSession` keyed by `session_id` (default: `'default'`).
- **Cart Calculations**:
  - `subtotal = sum(price * quantity)`
  - `free_diya_gift = subtotal >= 1999` (Complimentary Peacock Brass Diya automatically awarded)
  - `discount_amount = calculate_coupon(code, subtotal)`
  - `total = max(0, subtotal - discount_amount)`
- **Conversation Context**: Client preserves the rolling last 8 turns of dialogue history (`{ role, content }`) and forwards them on every turn to ensure multi-turn context memory.

---

## 6. Testing & Diagnostic Automation

Run backend test suite:
```bash
cd server
./venv/bin/pytest test_server.py
```
*(Covers catalog loading, filter criteria, coupon validation rules, tier thresholds, cart sessions, tool executions, and pincode estimation).*
