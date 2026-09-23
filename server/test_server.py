from catalog import get_all_products, get_product_by_id, filter_products, validate_coupon, estimate_delivery
from tools import get_session, reset_session, execute_tool

def test_catalog_load():
    products = get_all_products()
    assert len(products) >= 6
    assert any(p["id"] == "dw-01" for p in products)

def test_filter_products_budget():
    cheap_products = filter_products(max_budget=1000)
    assert len(cheap_products) > 0
    assert all(p["price"] <= 1000 for p in cheap_products)

def test_validate_coupon_success():
    res = validate_coupon("DIWALI20", 2000)
    assert res["valid"] is True
    assert res["discount_amount"] == 400.0

def test_validate_coupon_min_order():
    res = validate_coupon("DIWALI20", 500)
    assert res["valid"] is False

def test_cart_session_operations():
    session = get_session("test-user-1")
    # Add product
    add_res = session.add_item("dw-01", 2)
    assert add_res["success"] is True
    summary = session.get_summary()
    assert summary["total_items_count"] == 2
    assert summary["subtotal"] == 1499 * 2

    # Apply coupon
    coupon_res = session.apply_coupon("DIWALI20")
    assert coupon_res["success"] is True
    summary2 = session.get_summary()
    assert summary2["discount_amount"] > 0
    assert summary2["total"] == summary2["subtotal"] - summary2["discount_amount"]

def test_reset_session():
    session = get_session("test-reset-user")
    session.add_item("dw-01", 1)
    assert session.get_summary()["total_items_count"] == 1
    new_session = reset_session("test-reset-user")
    assert new_session.get_summary()["total_items_count"] == 0
    assert new_session.get_summary()["total"] == 0

def test_execute_tool_spotlight():
    res = execute_tool("highlight_product", {"product_id": "dw-02"}, "test-user-2")
    assert res["result"]["found"] is True
    assert res["ui_event"]["type"] == "SPOTLIGHT_PRODUCT"

def test_pincode_estimate():
    metro_res = estimate_delivery("110001")
    assert metro_res["valid"] is True
    assert metro_res["tier"] == "Metro Express"
