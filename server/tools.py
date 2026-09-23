from typing import Dict, Any, List, Optional
from catalog import PRODUCTS, get_all_products, get_product_by_id, filter_products, validate_coupon, estimate_delivery

class CartSession:
    def __init__(self, session_id: str = "default"):
        self.session_id = session_id
        self.items: Dict[str, Dict[str, Any]] = {}  # product_id -> {product, quantity}
        self.coupon_code: Optional[str] = None
        self.discount_amount: float = 0.0
        self.pincode: Optional[str] = None
        self.delivery_info: Optional[Dict[str, Any]] = None

    def add_item(self, product_id: str, quantity: int = 1) -> Dict[str, Any]:
        product = get_product_by_id(product_id)
        if not product:
            return {"success": False, "message": f"Product '{product_id}' not found in catalog."}
        
        pid = product["id"]
        if pid in self.items:
            self.items[pid]["quantity"] += quantity
        else:
            self.items[pid] = {
                "product": product,
                "quantity": quantity
            }
        
        self._recalculate_coupon()
        return {
            "success": True,
            "message": f"Added {quantity}x '{product['name']}' to cart.",
            "cart": self.get_summary()
        }

    def remove_item(self, product_id: str) -> Dict[str, Any]:
        product = get_product_by_id(product_id)
        if not product or product["id"] not in self.items:
            return {"success": False, "message": f"Item '{product_id}' is not in the cart."}
        
        removed_name = self.items[product["id"]]["product"]["name"]
        del self.items[product["id"]]
        self._recalculate_coupon()
        return {
            "success": True,
            "message": f"Removed '{removed_name}' from cart.",
            "cart": self.get_summary()
        }

    def apply_coupon(self, code: str) -> Dict[str, Any]:
        subtotal = self.get_subtotal()
        validation = validate_coupon(code, subtotal)
        if validation["valid"]:
            self.coupon_code = validation["code"]
            self.discount_amount = validation["discount_amount"]
            return {
                "success": True,
                "coupon_code": self.coupon_code,
                "discount_amount": self.discount_amount,
                "message": validation["message"],
                "cart": self.get_summary()
            }
        else:
            return {
                "success": False,
                "message": validation["message"],
                "cart": self.get_summary()
            }

    def set_pincode(self, pincode: str) -> Dict[str, Any]:
        delivery = estimate_delivery(pincode)
        if delivery["valid"]:
            self.pincode = pincode
            self.delivery_info = delivery
            return {
                "success": True,
                "delivery": delivery,
                "message": delivery["message"]
            }
        return {
            "success": False,
            "message": delivery["message"]
        }

    def get_subtotal(self) -> float:
        return sum(item["product"]["price"] * item["quantity"] for item in self.items.values())

    def _recalculate_coupon(self):
        if self.coupon_code:
            subtotal = self.get_subtotal()
            res = validate_coupon(self.coupon_code, subtotal)
            if res["valid"]:
                self.discount_amount = res["discount_amount"]
            else:
                self.coupon_code = None
                self.discount_amount = 0.0

    def get_summary(self) -> Dict[str, Any]:
        subtotal = self.get_subtotal()
        has_free_diya_gift = subtotal >= 1999
        total = max(0.0, subtotal - self.discount_amount)
        items_list = [
            {
                "id": pid,
                "name": data["product"]["name"],
                "price": data["product"]["price"],
                "quantity": data["quantity"],
                "total": data["product"]["price"] * data["quantity"],
                "image": data["product"]["image"]
            }
            for pid, data in self.items.items()
        ]
        return {
            "items": items_list,
            "total_items_count": sum(i["quantity"] for i in items_list),
            "subtotal": subtotal,
            "discount_amount": self.discount_amount,
            "coupon_code": self.coupon_code,
            "free_diya_gift": has_free_diya_gift,
            "total": total,
            "pincode": self.pincode,
            "delivery_info": self.delivery_info
        }

# Global active sessions
sessions: Dict[str, CartSession] = {}

def get_session(session_id: str = "default") -> CartSession:
    if session_id not in sessions:
        sessions[session_id] = CartSession(session_id)
    return sessions[session_id]

# Tool definitions formatted for Gemini
GEMINI_TOOLS_DECLARATIONS = [
    {
        "name": "search_products",
        "description": "Searches and filters the Diwali festive product catalog by budget, category, or keyword query.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "category": {
                    "type": "STRING",
                    "description": "Product category: 'hampers', 'sweets', 'dry-fruits', 'diyas', 'silver'."
                },
                "max_budget": {
                    "type": "NUMBER",
                    "description": "Maximum budget in Indian Rupees (INR) e.g. 2000."
                },
                "min_budget": {
                    "type": "NUMBER",
                    "description": "Minimum budget in Indian Rupees (INR)."
                },
                "query": {
                    "type": "STRING",
                    "description": "Search keyword e.g. 'ladoo', 'kaju', 'corporate', 'organic', 'gift'."
                }
            }
        }
    },
    {
        "name": "highlight_product",
        "description": "Highlights, zooms in, and spotlights a specific product on the user's screen while talking about it.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "product_id": {
                    "type": "STRING",
                    "description": "The product ID (e.g., 'dw-01', 'dw-02', 'dw-03', 'dw-04', 'dw-05', 'dw-06') or exact product name."
                }
            },
            "required": ["product_id"]
        }
    },
    {
        "name": "add_to_cart",
        "description": "Adds one or more units of a product to the customer's festive shopping cart.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "product_id": {
                    "type": "STRING",
                    "description": "Product ID (e.g. 'dw-01', 'dw-02', etc.) or name."
                },
                "quantity": {
                    "type": "INTEGER",
                    "description": "Quantity to add (default is 1)."
                }
            },
            "required": ["product_id"]
        }
    },
    {
        "name": "remove_from_cart",
        "description": "Removes an item from the customer's shopping cart.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "product_id": {
                    "type": "STRING",
                    "description": "Product ID or name to remove."
                }
            },
            "required": ["product_id"]
        }
    },
    {
        "name": "apply_festive_coupon",
        "description": "Applies a festive promo coupon code (e.g. 'DIWALI20', 'SHUBH10', 'LAKSHMI500') to unlock discounts.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "coupon_code": {
                    "type": "STRING",
                    "description": "Festive promo coupon code (e.g. 'DIWALI20')."
                }
            },
            "required": ["coupon_code"]
        }
    },
    {
        "name": "check_delivery_pincode",
        "description": "Checks express shipping availability and guaranteed pre-Diwali delivery arrival for a 6-digit Indian pincode.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "pincode": {
                    "type": "STRING",
                    "description": "6-digit Indian postal pincode (e.g. '110001', '400001', '560001')."
                }
            },
            "required": ["pincode"]
        }
    },
    {
        "name": "view_cart_and_checkout",
        "description": "Opens the cart drawer and presents the final order summary with free gift qualification and payment links.",
        "parameters": {
            "type": "OBJECT",
            "properties": {}
        }
    }
]

def execute_tool(name: str, args: Dict[str, Any], session_id: str = "default") -> Dict[str, Any]:
    session = get_session(session_id)
    ui_event = None

    if name == "search_products":
        category = args.get("category")
        max_budget = args.get("max_budget")
        min_budget = args.get("min_budget")
        query = args.get("query")
        results = filter_products(category=category, max_budget=max_budget, min_budget=min_budget, query=query)
        ui_event = {
            "type": "FILTER_PRODUCTS",
            "payload": {
                "matched_ids": [p["id"] for p in results],
                "category": category,
                "query": query
            }
        }
        return {
            "result": [
                {"id": p["id"], "name": p["name"], "price": p["price"], "badge": p["badge"], "subtitle": p["subtitle"]}
                for p in results
            ],
            "ui_event": ui_event
        }

    elif name == "highlight_product":
        product_id = args.get("product_id", "")
        product = get_product_by_id(product_id)
        if product:
            ui_event = {
                "type": "SPOTLIGHT_PRODUCT",
                "payload": {"product": product}
            }
            return {
                "result": {"found": True, "product": product},
                "ui_event": ui_event
            }
        return {
            "result": {"found": False, "message": f"Product '{product_id}' not found."},
            "ui_event": None
        }

    elif name == "add_to_cart":
        product_id = args.get("product_id", "")
        quantity = int(args.get("quantity", 1))
        res = session.add_item(product_id, quantity)
        if res["success"]:
            product = get_product_by_id(product_id)
            ui_event = {
                "type": "CART_UPDATED",
                "payload": {
                    "cart": res["cart"],
                    "action": "added",
                    "product": product,
                    "quantity": quantity
                }
            }
        return {"result": res, "ui_event": ui_event}

    elif name == "remove_from_cart":
        product_id = args.get("product_id", "")
        res = session.remove_item(product_id)
        ui_event = {
            "type": "CART_UPDATED",
            "payload": {"cart": session.get_summary(), "action": "removed"}
        }
        return {"result": res, "ui_event": ui_event}

    elif name == "apply_festive_coupon":
        code = args.get("coupon_code", "")
        res = session.apply_coupon(code)
        ui_event = {
            "type": "COUPON_APPLIED",
            "payload": {
                "success": res["success"],
                "code": code,
                "discount": res.get("discount_amount", 0),
                "cart": session.get_summary()
            }
        }
        return {"result": res, "ui_event": ui_event}

    elif name == "check_delivery_pincode":
        pincode = args.get("pincode", "")
        res = session.set_pincode(pincode)
        ui_event = {
            "type": "PINCODE_CHECKED",
            "payload": res
        }
        return {"result": res, "ui_event": ui_event}

    elif name == "view_cart_and_checkout":
        summary = session.get_summary()
        ui_event = {
            "type": "OPEN_CHECKOUT",
            "payload": {"cart": summary}
        }
        return {"result": summary, "ui_event": ui_event}

    return {"result": {"error": f"Unknown tool: {name}"}, "ui_event": None}
