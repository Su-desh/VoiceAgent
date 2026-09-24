import json
import logging
from typing import List, Dict, Any, Optional
from config import GEMINI_API_KEY, GEMINI_CHAT_MODEL
from prompts import SYSTEM_INSTRUCTION
from tools import GEMINI_TOOLS_DECLARATIONS, execute_tool, get_session
from catalog import PRODUCTS, COUPONS

logger = logging.getLogger("chat_service")
logger.setLevel(logging.INFO)

class ChatService:
    def __init__(self):
        self.client = None
        if GEMINI_API_KEY:
            try:
                from google import genai
                self.client = genai.Client(api_key=GEMINI_API_KEY)
                logger.info("Google GenAI client initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize GenAI client: {e}")

    async def handle_message(self, message: str, session_id: str = "default", history: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Processes a user spoken/text message, executes tools if model requests,
        and returns { reply: str, ui_events: List[Dict], cart: Dict }.
        If GEMINI_API_KEY is not configured or offline, uses intelligent rule-based sales simulation.
        """
        if self.client and GEMINI_API_KEY:
            try:
                return await self._call_gemini_api(message, session_id, history or [])
            except Exception as e:
                logger.error(f"Error calling Gemini Chat API: {e}, falling back to sales heuristic engine.")
                return self._fallback_sales_engine(message, session_id)
        else:
            return self._fallback_sales_engine(message, session_id)

    async def _call_gemini_api(self, message: str, session_id: str, history: List[Dict[str, Any]]) -> Dict[str, Any]:
        from google.genai import types

        ui_events = []
        session = get_session(session_id)

        # Convert tool declarations to GenAI types
        function_declarations = []
        for decl in GEMINI_TOOLS_DECLARATIONS:
            function_declarations.append(types.FunctionDeclaration(
                name=decl["name"],
                description=decl["description"],
                parameters=decl.get("parameters")
            ))

        tools_config = [types.Tool(function_declarations=function_declarations)]

        # Prepare messages
        contents = []
        for h in history[-8:]:  # Keep recent context
            role = "user" if h.get("role") == "user" else "model"
            contents.append(types.Content(role=role, parts=[types.Part.from_text(text=h.get("content", ""))]))
        contents.append(types.Content(role="user", parts=[types.Part.from_text(text=message)]))

        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=0.7,
            tools=tools_config
        )

        response = self.client.models.generate_content(
            model=GEMINI_CHAT_MODEL,
            contents=contents,
            config=config
        )

        reply_text = ""
        # Check for function calls
        if response.function_calls:
            tool_parts = []
            for call in response.function_calls:
                call_name = call.name
                call_args = call.args or {}
                logger.info(f"GenAI function call: {call_name} with {call_args}")
                tool_res = execute_tool(call_name, call_args, session_id)
                if tool_res.get("ui_event"):
                    ui_events.append(tool_res["ui_event"])

                tool_parts.append(types.Part.from_function_response(
                    name=call_name,
                    response={"result": tool_res.get("result")}
                ))

            if tool_parts:
                follow_up = self.client.models.generate_content(
                    model=GEMINI_CHAT_MODEL,
                    contents=[*contents, response.candidates[0].content, types.Content(role="user", parts=tool_parts)],
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        temperature=0.7
                    )
                )
                if follow_up.text:
                    reply_text = follow_up.text.strip()
        
        if not reply_text and response.text:
            reply_text = response.text.strip()

        return {
            "reply": reply_text.strip(),
            "ui_events": ui_events,
            "cart": session.get_summary()
        }

    def _fallback_sales_engine(self, message: str, session_id: str) -> Dict[str, Any]:
        """
        Intelligent consultative heuristic engine for 100% demo safety when offline or without API key.
        """
        session = get_session(session_id)
        msg_lower = message.lower()
        ui_events = []
        reply = ""

        # 1. Objections or coupons
        if "coupon" in msg_lower or "discount" in msg_lower or "code" in msg_lower or "offer" in msg_lower or "deal" in msg_lower:
            res = session.apply_coupon("DIWALI20")
            ui_events.append({
                "type": "COUPON_APPLIED",
                "payload": {"code": "DIWALI20", "discount": res.get("discount_amount", 0), "cart": session.get_summary()}
            })
            reply = "I've applied our exclusive festive coupon DIWALI20 to your cart! You get 20% off your celebration order, plus orders above ₹1,999 include a complimentary handcrafted brass diya."

        # 2. Add to cart
        elif "add" in msg_lower or "buy" in msg_lower or "order" in msg_lower:
            target_product = PRODUCTS[0]
            qty = 1
            if "sweet" in msg_lower or "mithai" in msg_lower or "swarna" in msg_lower:
                target_product = PRODUCTS[1]
            elif "diya" in msg_lower or "terracotta" in msg_lower or "anandam" in msg_lower:
                target_product = PRODUCTS[2]
            elif "corporate" in msg_lower or "celebration" in msg_lower or "trunk" in msg_lower:
                target_product = PRODUCTS[3]
            elif "silver" in msg_lower or "coin" in msg_lower or "lakshmi" in msg_lower:
                target_product = PRODUCTS[4]
            elif "saffron" in msg_lower or "kesariya" in msg_lower:
                target_product = PRODUCTS[5]

            # Check quantity
            for word in msg_lower.split():
                if word.isdigit():
                    qty = int(word)
                    break

            res = session.add_item(target_product["id"], qty)
            ui_events.append({
                "type": "CART_UPDATED",
                "payload": {"cart": session.get_summary(), "action": "added", "product": target_product, "quantity": qty}
            })
            reply = f"Wonderful choice! I've added {qty} of the {target_product['name']} to your festive cart. Would you like me to check delivery to your pincode, or apply our DIWALI20 festive discount?"

        # 3. Pincode / Delivery
        elif any(p.isdigit() and len(p) == 6 for p in msg_lower.replace(",", " ").split()) or "pincode" in msg_lower or "delivery" in msg_lower or "deliver" in msg_lower:
            pin = "110001"
            for token in msg_lower.replace(",", " ").replace(".", " ").split():
                if token.isdigit() and len(token) == 6:
                    pin = token
                    break
            deliv = session.set_pincode(pin)
            ui_events.append({
                "type": "PINCODE_CHECKED",
                "payload": deliv
            })
            reply = f"Great news! Express shipping is available for pincode {pin}. Your festive order is guaranteed to arrive within 24 to 48 hours before Diwali with free premium gift packaging."

        # 4. Gifting Recommendations: Corporate
        elif "corporate" in msg_lower or "office" in msg_lower or "client" in msg_lower or "colleague" in msg_lower or "team" in msg_lower:
            prod = PRODUCTS[3] # Grand Celebration Corporate Hamper
            ui_events.append({"type": "SPOTLIGHT_PRODUCT", "payload": {"product": prod}})
            reply = f"For corporate gifting and VIP clients, I highly recommend our Grand Celebration Corporate Hamper! It comes in a luxurious royal midnight blue velvet trunk with premium Darjeeling first flush tea and gourmet treats for ₹{prod['price']:,}."

        # 5. Gifting Recommendations: Budget under 1000 / 1500 / 2000
        elif "under" in msg_lower or "budget" in msg_lower or "1000" in msg_lower or "1500" in msg_lower:
            if "1000" in msg_lower or "800" in msg_lower:
                prod = PRODUCTS[2] # Anandam Terracotta Diya Set
            else:
                prod = PRODUCTS[0] # Royal Shahi Dry Fruit Box
            ui_events.append({"type": "SPOTLIGHT_PRODUCT", "payload": {"product": prod}})
            reply = f"I have the ideal festive selection for your budget: the {prod['name']} at just ₹{prod['price']:,}! It features {prod['subtitle']}. Shall I add this to your festive cart?"

        # 6. Sweets / Mithai
        elif "sweet" in msg_lower or "mithai" in msg_lower or "kaju" in msg_lower or "ladoo" in msg_lower:
            prod = PRODUCTS[1]
            ui_events.append({"type": "SPOTLIGHT_PRODUCT", "payload": {"product": prod}})
            reply = f"For traditional festivities, our Swarna Luxury Mithai & Brass Diya Hamper is our most cherished pick. It includes pure desi ghee Kaju Katli and Motichoor Ladoos paired with an engraved peacock Diya for ₹{prod['price']:,}."

        # 7. Silver / Auspicious / Pooja
        elif "silver" in msg_lower or "coin" in msg_lower or "pooja" in msg_lower or "dhanteras" in msg_lower:
            prod = PRODUCTS[4]
            ui_events.append({"type": "SPOTLIGHT_PRODUCT", "payload": {"product": prod}})
            reply = f"For auspicious pooja blessings and Dhanteras, our Shubh Lakshmi-Ganesh 999 Pure Silver Coin Box is certified and presented with holy Gangajal and roli chawal at ₹{prod['price']:,}."

        # 8. Checkout / summary
        elif "checkout" in msg_lower or "pay" in msg_lower or "cart" in msg_lower or "finish" in msg_lower:
            ui_events.append({"type": "OPEN_CHECKOUT", "payload": {"cart": session.get_summary()}})
            total = session.get_summary()["total"]
            reply = f"Here is your festive cart summary! Your total after festive savings is ₹{round(total):,}. You can complete your order securely via UPI or Card right now."

        # Default Greeting & Discovery
        else:
            ui_events.append({"type": "SPOTLIGHT_PRODUCT", "payload": {"product": PRODUCTS[0]}})
            reply = "Shubh Deepavali! Welcome to our Grand Diwali Showcase. I'm Aarav, your personal festive concierge. Are you looking for gifts for your family, friends, or corporate colleagues today?"

        return {
            "reply": reply,
            "ui_events": ui_events,
            "cart": session.get_summary()
        }

chat_service = ChatService()
