"""Stripe payments (Flow A claimable sandbox): invoice checkout, status, webhook."""
import os
import stripe
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from core import db, NO_ID, new_id, now_iso, get_current_business

router = APIRouter(tags=["payments"])
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")


class CheckoutIn(BaseModel):
    invoice_id: str
    origin_url: str


@router.post("/api/payments/checkout")
async def checkout(body: CheckoutIn, business: dict = Depends(get_current_business)):
    inv = await db.invoices.find_one({"id": body.invoice_id, "business_id": business["id"]}, NO_ID)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    amount_cents = int(round(float(inv["amount"]) * 100))
    line_items = [{
        "price_data": {
            "currency": "usd",
            "product_data": {"name": f"{inv['number']} — {inv['description']}"},
            "unit_amount": amount_cents,
        },
        "quantity": 1,
    }]
    kwargs = dict(
        line_items=line_items,
        mode="payment",
        success_url=f"{body.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{body.origin_url}/payment/cancel",
        metadata={"invoice_id": inv["id"], "business_id": business["id"]},
    )
    try:
        session = stripe.checkout.Session.create(
            **kwargs, automatic_tax={"enabled": True}, billing_address_collection="required")
    except stripe.error.InvalidRequestError:
        session = stripe.checkout.Session.create(**kwargs)

    await db.payment_transactions.insert_one({
        "id": new_id(),
        "session_id": session.id,
        "business_id": business["id"],
        "invoice_id": inv["id"],
        "amount": float(inv["amount"]),
        "currency": "usd",
        "status": "initiated",
        "payment_status": "pending",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    await db.invoices.update_one({"id": inv["id"]}, {"$set": {"session_id": session.id, "status": "pending"}})
    return {"checkout_url": session.url, "session_id": session.id}


@router.get("/api/payments/status/{session_id}")
async def status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id}, NO_ID)
    if not record:
        raise HTTPException(404, "Transaction not found")
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid", "updated_at": now_iso()}})
                await db.invoices.update_one({"session_id": session_id}, {"$set": {"status": "paid"}})
                record = await db.payment_transactions.find_one({"session_id": session_id}, NO_ID)
        except stripe.error.StripeError:
            pass
    return {"session_id": record["session_id"], "status": record["status"], "payment_status": record["payment_status"]}


@router.post("/api/stripe/webhook")
async def webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(400, "Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": obj.get("payment_status", "paid"), "updated_at": now_iso()}})
        await db.invoices.update_one({"session_id": obj["id"]}, {"$set": {"status": "paid"}})
    elif t == "checkout.session.expired":
        await db.payment_transactions.update_one({"session_id": obj["id"]},
            {"$set": {"status": "expired", "payment_status": "expired", "updated_at": now_iso()}})
    return {"status": "ok"}
