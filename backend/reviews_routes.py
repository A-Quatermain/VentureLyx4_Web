"""Reviews / reputation: tracking, review requests, AI-drafted responses with approval."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from core import db, NO_ID, new_id, now_iso, get_current_business
import ai_service

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


class ReviewIn(BaseModel):
    author: str = Field(min_length=1)
    rating: int = Field(ge=1, le=5)
    text: str = ""
    source: str = "Google"


class ReviewRequestIn(BaseModel):
    customer_name: str = Field(min_length=1)
    channel: str = "email"  # email | sms
    contact: Optional[str] = ""


class ApproveIn(BaseModel):
    response_text: str


@router.get("/summary")
async def summary(business: dict = Depends(get_current_business)):
    reviews = await db.reviews.find({"business_id": business["id"]}, NO_ID).to_list(1000)
    count = len(reviews)
    avg = round(sum(r["rating"] for r in reviews) / count, 1) if count else 0.0
    # monthly trend
    buckets = {}
    for r in reviews:
        m = r["created_at"][:7]
        buckets.setdefault(m, []).append(r["rating"])
    trend = [{"month": k, "count": len(v), "avg": round(sum(v) / len(v), 1)} for k, v in sorted(buckets.items())]
    dist = {str(s): sum(1 for r in reviews if r["rating"] == s) for s in range(1, 6)}
    requests = await db.review_requests.count_documents({"business_id": business["id"]})
    return {"count": count, "average": avg, "trend": trend[-6:], "distribution": dist, "requests_sent": requests}


@router.get("")
async def list_reviews(business: dict = Depends(get_current_business)):
    return await db.reviews.find({"business_id": business["id"]}, NO_ID).sort("created_at", -1).to_list(200)


@router.post("")
async def create_review(body: ReviewIn, business: dict = Depends(get_current_business)):
    doc = {"id": new_id(), "business_id": business["id"], **body.model_dump(),
           "ai_response": None, "response_status": "none", "created_at": now_iso()}
    await db.reviews.insert_one(doc)
    return await db.reviews.find_one({"id": doc["id"]}, NO_ID)


@router.post("/{review_id}/ai-response")
async def ai_response(review_id: str, business: dict = Depends(get_current_business)):
    r = await db.reviews.find_one({"id": review_id, "business_id": business["id"]}, NO_ID)
    if not r:
        raise HTTPException(404, "Review not found")
    system = ("You draft warm, professional review responses for a small business owner. "
              "Keep it under 90 words, genuine, thank the customer by name, address specifics, "
              "invite them back. For negative reviews, be empathetic, apologize, offer to make it right offline. No hashtags.")
    prompt = (f"Business: {business['name']} ({business['industry']}).\n"
              f"Review by {r['author']} — {r['rating']} stars on {r['source']}:\n\"{r['text']}\"\n\n"
              "Write the owner's reply.")
    pref = business.get("ai_preference", "auto")
    bid = business["id"]

    async def gen():
        acc = ""
        async for chunk in ai_service.generate_stream("review_response", system, prompt,
                                                      business_id=bid, preference=pref):
            acc += chunk
            yield chunk
        await db.reviews.update_one({"id": review_id},
                                    {"$set": {"ai_response": acc.strip(), "response_status": "draft"}})

    return StreamingResponse(gen(), media_type="text/plain",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/{review_id}/approve")
async def approve_response(review_id: str, body: ApproveIn, business: dict = Depends(get_current_business)):
    res = await db.reviews.update_one(
        {"id": review_id, "business_id": business["id"]},
        {"$set": {"ai_response": body.response_text.strip(), "response_status": "approved"}})
    if res.matched_count == 0:
        raise HTTPException(404, "Review not found")
    return await db.reviews.find_one({"id": review_id}, NO_ID)


@router.post("/requests")
async def send_request(body: ReviewRequestIn, business: dict = Depends(get_current_business)):
    doc = {"id": new_id(), "business_id": business["id"], **body.model_dump(),
           "status": "sent", "created_at": now_iso()}
    await db.review_requests.insert_one(doc)
    return {"ok": True, "message": f"Review request queued for {body.customer_name} via {body.channel}.", "request": {k: v for k, v in doc.items()}}
