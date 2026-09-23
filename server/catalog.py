from typing import List, Optional, Dict, Any

PRODUCTS: List[Dict[str, Any]] = [
    {
        "id": "dw-01",
        "name": "Royal Shahi Dry Fruit Box",
        "subtitle": "Kashmiri Walnuts, Roasted Pistachios, Jumbo Almonds & Cashews",
        "category": "dry-fruits",
        "price": 1499,
        "original_price": 1999,
        "rating": 4.9,
        "reviews": 128,
        "image": "/images/products/dw-01.jpg",
        "badge": "Bestseller",
        "description": "Handpicked 4-tier artisanal dry fruit wooden keepsake box featuring Californian jumbo almonds, roasted and salted Afghan pistachios, Goan cashews, and Kashmiri walnut kernels. Net weight 800g.",
        "festive_note": "Auspicious gift for family elders, colleagues, and festive poojas.",
        "in_stock": True,
        "stock_count": 45
    },
    {
        "id": "dw-02",
        "name": "Swarna Luxury Mithai & Brass Diya Hamper",
        "subtitle": "Artisanal Kaju Katli, Besan Ladoo, Saffron Motichoor & Engraved Brass Diya",
        "category": "sweets",
        "price": 2199,
        "original_price": 2799,
        "rating": 4.8,
        "reviews": 94,
        "image": "/images/products/dw-02.jpg",
        "badge": "Festive Favorite",
        "description": "Pure desi ghee confectionery crafted by master halwais. Includes 250g Silver-foiled Kaju Katli, 250g Shahi Motichoor Ladoo, 200g Besan Ladoo, paired with a solid brass hand-engraved peacock Diya.",
        "festive_note": "Ideal traditional gift for relatives, housewarmings, and festive dinners.",
        "in_stock": True,
        "stock_count": 30
    },
    {
        "id": "dw-03",
        "name": "Anandam Handcrafted Terracotta Diya Set",
        "subtitle": "Set of 6 Organic Hand-painted Diyas with Soy Wax & Rose Petals",
        "category": "diyas",
        "price": 799,
        "original_price": 1099,
        "rating": 4.9,
        "reviews": 210,
        "image": "/images/products/dw-03.jpg",
        "badge": "Eco Friendly",
        "description": "Meticulously molded and painted by rural Indian artisans using organic clay, natural vibrant colors, and pre-filled with organic smokeless soy wax scented with cardamom and Indian rose.",
        "festive_note": "Brings traditional warmth and divine glow to entrance balconies and rangolis.",
        "in_stock": True,
        "stock_count": 120
    },
    {
        "id": "dw-04",
        "name": "Grand Celebration Corporate Hamper",
        "subtitle": "Artisanal Gourmet Snacks, Darjeeling First Flush Tea, Dry Fruits & Diya",
        "category": "hampers",
        "price": 2899,
        "original_price": 3500,
        "rating": 5.0,
        "reviews": 68,
        "image": "/images/products/dw-04.jpg",
        "badge": "Corporate Luxury",
        "description": "Executive celebratory hamper presented in a royal midnight blue velvet trunk. Contains estate Darjeeling first-flush tea, Belgian chocolate florentines, salted peri-peri makhanas, premium dry fruits, and gold-foiled greeting card.",
        "festive_note": "Top choice for corporate gifting, VIP clients, and executive colleagues.",
        "in_stock": True,
        "stock_count": 25
    },
    {
        "id": "dw-05",
        "name": "Shubh Lakshmi-Ganesh 999 Silver Coin Box",
        "subtitle": "10g Hallmarked Pure Silver Coin with Gangajal & Roli Chawal",
        "category": "silver",
        "price": 3499,
        "original_price": 3999,
        "rating": 5.0,
        "reviews": 42,
        "image": "/images/products/dw-05.jpg",
        "badge": "Auspicious",
        "description": "Certified 999 Fine Silver 10-gram coin embossed with Goddess Lakshmi and Lord Ganesha in proof finish. Presented in a crimson velvet box with consecrated Gangajal vial and brass pooja thali accessories.",
        "festive_note": "Auspicious investment and blessing gift for Dhanteras and Diwali Pooja.",
        "in_stock": True,
        "stock_count": 15
    },
    {
        "id": "dw-06",
        "name": "Kesariya Saffron & Rose Sweet Platter",
        "subtitle": "Assorted Gourmet Sweets Infused with Kashmiri Mongra Saffron",
        "category": "sweets",
        "price": 1299,
        "original_price": 1699,
        "rating": 4.7,
        "reviews": 85,
        "image": "/images/products/dw-06.jpg",
        "badge": "Chef Special",
        "description": "Luxury confectionery box featuring Saffron Peda, Rose Petal Kaju Roll, and Walnut Fudge made with zero refined sugar and 100% pure A2 Gir Cow ghee. Shelf life: 15 days.",
        "festive_note": "Guilt-free indulgence for modern festive celebrations.",
        "in_stock": True,
        "stock_count": 50
    }
]

COUPONS: Dict[str, Dict[str, Any]] = {
    "DIWALI20": {
        "code": "DIWALI20",
        "discount_percent": 20,
        "max_discount": 1000,
        "min_order": 1200,
        "description": "20% festive discount on orders above ₹1,200 (up to ₹1,000 off)"
    },
    "SHUBH10": {
        "code": "SHUBH10",
        "discount_percent": 10,
        "max_discount": 500,
        "min_order": 500,
        "description": "Flat 10% off on all festive orders"
    },
    "LAKSHMI500": {
        "code": "LAKSHMI500",
        "flat_discount": 500,
        "min_order": 2500,
        "description": "Flat ₹500 off on luxury hampers and orders above ₹2,500"
    }
}

def get_all_products() -> List[Dict[str, Any]]:
    return PRODUCTS

def get_product_by_id(product_id: str) -> Optional[Dict[str, Any]]:
    for p in PRODUCTS:
        if p["id"].lower() == product_id.lower() or product_id.lower() in p["name"].lower():
            return p
    return None

def filter_products(
    category: Optional[str] = None,
    max_budget: Optional[float] = None,
    min_budget: Optional[float] = None,
    query: Optional[str] = None
) -> List[Dict[str, Any]]:
    results = PRODUCTS
    if category:
        cat_lower = category.lower().strip()
        results = [p for p in results if cat_lower in p["category"].lower() or cat_lower in p["name"].lower()]
    if max_budget is not None and max_budget > 0:
        results = [p for p in results if p["price"] <= max_budget]
    if min_budget is not None and min_budget > 0:
        results = [p for p in results if p["price"] >= min_budget]
    if query:
        q_lower = query.lower().strip()
        results = [
            p for p in results 
            if q_lower in p["name"].lower() 
            or q_lower in p["description"].lower() 
            or q_lower in p["subtitle"].lower()
            or q_lower in p["category"].lower()
        ]
    return results

def validate_coupon(code: str, cart_total: float) -> Dict[str, Any]:
    code_upper = code.strip().upper()
    if code_upper not in COUPONS:
        return {"valid": False, "message": f"Coupon '{code_upper}' is invalid or expired."}
    
    coupon = COUPONS[code_upper]
    min_order = coupon.get("min_order", 0)
    if cart_total < min_order:
        return {
            "valid": False,
            "message": f"Coupon '{code_upper}' requires a minimum order of ₹{min_order:,}. Current cart total is ₹{cart_total:,}."
        }
    
    discount = 0.0
    if "discount_percent" in coupon:
        discount = (coupon["discount_percent"] / 100.0) * cart_total
        if "max_discount" in coupon and discount > coupon["max_discount"]:
            discount = coupon["max_discount"]
    elif "flat_discount" in coupon:
        discount = float(coupon["flat_discount"])
    
    return {
        "valid": True,
        "code": code_upper,
        "discount_amount": round(discount, 2),
        "description": coupon["description"],
        "message": f"Festive coupon '{code_upper}' applied successfully! You saved ₹{round(discount):,}."
    }

def estimate_delivery(pincode: str) -> Dict[str, Any]:
    pin = pincode.strip()
    # Simple Indian pincode routing rules for demo
    if not (pin.isdigit() and len(pin) == 6):
        return {
            "valid": False,
            "message": "Please provide a valid 6-digit Indian delivery pincode (e.g., 110001, 400001, 560001)."
        }
    
    metro_prefixes = ["11", "12", "20", "40", "56", "60", "70", "50"]
    is_metro = any(pin.startswith(prefix) for prefix in metro_prefixes)
    
    if is_metro:
        return {
            "valid": True,
            "pincode": pin,
            "tier": "Metro Express",
            "eta_days": "1 - 2 business days",
            "guaranteed_diwali_delivery": True,
            "shipping_charge": 0,
            "message": f"Express shipping available for pincode {pin}! Guaranteed delivery in 24-48 hours before Diwali with free festive gift packaging."
        }
    else:
        return {
            "valid": True,
            "pincode": pin,
            "tier": "Standard Courier",
            "eta_days": "2 - 3 business days",
            "guaranteed_diwali_delivery": True,
            "shipping_charge": 0,
            "message": f"Standard delivery confirmed for pincode {pin}. Estimated arrival in 2-3 business days with insured festive transit."
        }
