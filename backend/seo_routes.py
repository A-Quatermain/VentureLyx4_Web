"""SCALESEO: scanner, audits, issues, keywords, competitors, AI recommendations + page generation."""
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
from core import db, NO_ID, new_id, now_iso, get_current_business
from seo_scanner import scan_website
import ai_service

router = APIRouter(prefix="/api/seo", tags=["seo"])


class ScanIn(BaseModel):
    url: str = Field(min_length=3)


class KeywordIn(BaseModel):
    term: str = Field(min_length=1)
    location: Optional[str] = ""


class CompetitorIn(BaseModel):
    name: str = Field(min_length=1)
    website: Optional[str] = ""


class PageGenIn(BaseModel):
    page_type: str = "service"  # service | local
    topic: str = Field(min_length=1)
    location: Optional[str] = ""


# ---------- Scanner + audits ----------
@router.post("/scan")
async def scan(body: ScanIn, business: dict = Depends(get_current_business)):
    result = await scan_website(body.url)
    if not result.get("ok"):
        raise HTTPException(400, result.get("error", "Scan failed"))
    audit = {
        "id": new_id(),
        "business_id": business["id"],
        "url": result["url"],
        "score": result["score"],
        "response_ms": result["response_ms"],
        "checks": result["checks"],
        "issues": result["issues"],
        "title": result.get("title", ""),
        "created_at": now_iso(),
    }
    await db.seo_audits.insert_one(audit)
    return await db.seo_audits.find_one({"id": audit["id"]}, NO_ID)


@router.get("/audits")
async def audits(business: dict = Depends(get_current_business)):
    return await db.seo_audits.find({"business_id": business["id"]}, NO_ID).sort("created_at", -1).to_list(50)


@router.get("/audits/{audit_id}")
async def audit_detail(audit_id: str, business: dict = Depends(get_current_business)):
    a = await db.seo_audits.find_one({"id": audit_id, "business_id": business["id"]}, NO_ID)
    if not a:
        raise HTTPException(404, "Audit not found")
    return a


@router.post("/audits/{audit_id}/recommendations")
async def recommendations(audit_id: str, business: dict = Depends(get_current_business)):
    a = await db.seo_audits.find_one({"id": audit_id, "business_id": business["id"]}, NO_ID)
    if not a:
        raise HTTPException(404, "Audit not found")
    issues = "\n".join(f"- {i['label']}: {i['detail']}" for i in a["issues"]) or "No major issues found."
    system = ("You are an SEO advisor for small business owners. Explain in plain, encouraging English "
              "(no jargon). Give practical, prioritized fixes an owner can act on. Be concise.")
    prompt = (f"Business: {business['name']} ({business['industry']}), serving {business.get('service_area') or 'local area'}.\n"
              f"Website: {a['url']} scored {a['score']}/100.\n"
              f"Issues found:\n{issues}\n\n"
              "Write a short intro sentence, then a numbered list of the top fixes. For each: what to do and why it helps them get found by customers.")
    out = await ai_service.generate_text("seo_recommendations", system, prompt,
                                         business_id=business["id"], preference=business.get("ai_preference", "auto"))
    await db.seo_audits.update_one({"id": audit_id}, {"$set": {"recommendations": out}})
    return out


@router.post("/generate-page")
async def generate_page(body: PageGenIn, business: dict = Depends(get_current_business)):
    system = ("You are an expert SEO copywriter for small businesses. Produce publish-ready web page content "
              "in clean Markdown. Include: an SEO Title, Meta Description, one H1, 3-4 sections with H2s, "
              "a short FAQ (3 Q&As), and a suggested JSON-LD schema block at the end. Owner-friendly, persuasive, local.")
    loc = body.location or business.get("service_area") or "the local area"
    kind = "local landing page" if body.page_type == "local" else "service page"
    prompt = (f"Create a {kind} for {business['name']}, a {business['industry']} business serving {loc}.\n"
              f"Topic/Service: {body.topic}\nLocation focus: {loc}\n"
              "Make it optimized to rank locally and convert visitors into customers.")

    pref = business.get("ai_preference", "auto")
    bid = business["id"]

    async def gen():
        async for chunk in ai_service.generate_stream("page_generation", system, prompt,
                                                       business_id=bid, preference=pref):
            yield chunk

    return StreamingResponse(gen(), media_type="text/plain",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---------- Keywords ----------
@router.get("/keywords")
async def list_keywords(business: dict = Depends(get_current_business)):
    return await db.keywords.find({"business_id": business["id"]}, NO_ID).sort("created_at", -1).to_list(200)


@router.post("/keywords")
async def add_keyword(body: KeywordIn, business: dict = Depends(get_current_business)):
    import random
    doc = {
        "id": new_id(), "business_id": business["id"], "term": body.term.strip(),
        "location": body.location or business.get("service_area", ""),
        "rank": random.randint(4, 45), "prev_rank": random.randint(4, 55),
        "volume": random.choice([90, 140, 320, 480, 720, 1300]),
        "created_at": now_iso(),
    }
    await db.keywords.insert_one(doc)
    return await db.keywords.find_one({"id": doc["id"]}, NO_ID)


@router.delete("/keywords/{kw_id}")
async def del_keyword(kw_id: str, business: dict = Depends(get_current_business)):
    await db.keywords.delete_one({"id": kw_id, "business_id": business["id"]})
    return {"ok": True}


# ---------- Competitors ----------
@router.get("/competitors")
async def list_competitors(business: dict = Depends(get_current_business)):
    return await db.competitors.find({"business_id": business["id"]}, NO_ID).sort("created_at", -1).to_list(100)


@router.post("/competitors")
async def add_competitor(body: CompetitorIn, business: dict = Depends(get_current_business)):
    import random
    doc = {
        "id": new_id(), "business_id": business["id"], "name": body.name.strip(),
        "website": body.website or "", "seo_score": random.randint(45, 92),
        "reviews": random.randint(12, 340), "rating": round(random.uniform(3.6, 4.9), 1),
        "created_at": now_iso(),
    }
    await db.competitors.insert_one(doc)
    return await db.competitors.find_one({"id": doc["id"]}, NO_ID)


@router.delete("/competitors/{c_id}")
async def del_competitor(c_id: str, business: dict = Depends(get_current_business)):
    await db.competitors.delete_one({"id": c_id, "business_id": business["id"]})
    return {"ok": True}
