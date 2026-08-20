"""Business Command Center: metrics, growth score, AI Next Best Action."""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from core import db, NO_ID, now_iso, get_current_business
import ai_service

router = APIRouter(prefix="/api/command-center", tags=["command-center"])


async def _metrics(business_id: str):
    leads = await db.leads.find({"business_id": business_id}, NO_ID).to_list(1000)
    customers = await db.customers.count_documents({"business_id": business_id})
    jobs = await db.jobs.find({"business_id": business_id}, NO_ID).to_list(1000)
    invoices = await db.invoices.find({"business_id": business_id}, NO_ID).to_list(1000)
    reviews = await db.reviews.find({"business_id": business_id}, NO_ID).to_list(1000)
    latest_audit = await db.seo_audits.find({"business_id": business_id}, NO_ID).sort("created_at", -1).to_list(1)

    open_stages = {"new", "contacted", "quoted"}
    pipeline_value = sum(l.get("value", 0) for l in leads if l.get("stage") in open_stages)
    open_leads = sum(1 for l in leads if l.get("stage") in open_stages)
    won = sum(1 for l in leads if l.get("stage") == "won")

    revenue = sum(i.get("amount", 0) for i in invoices if i.get("status") == "paid")
    outstanding = sum(i.get("amount", 0) for i in invoices if i.get("status") != "paid")

    upcoming_jobs = sum(1 for j in jobs if j.get("status") in ("scheduled", "in_progress"))
    seo_score = latest_audit[0]["score"] if latest_audit else 0
    rating = round(sum(r["rating"] for r in reviews) / len(reviews), 1) if reviews else 0.0

    # Growth score: weighted blend
    seo_c = seo_score
    rev_c = min(100, revenue / 100) if revenue else 0
    lead_c = min(100, open_leads * 12)
    review_c = (rating / 5 * 100) if rating else 0
    pipe_c = min(100, pipeline_value / 200) if pipeline_value else 0
    growth = round(0.25 * seo_c + 0.2 * rev_c + 0.2 * lead_c + 0.2 * review_c + 0.15 * pipe_c)

    return {
        "growth_score": growth,
        "revenue": round(revenue, 2),
        "outstanding": round(outstanding, 2),
        "open_leads": open_leads,
        "pipeline_value": round(pipeline_value, 2),
        "won_leads": won,
        "customers": customers,
        "seo_score": seo_score,
        "rating": rating,
        "review_count": len(reviews),
        "upcoming_jobs": upcoming_jobs,
        "total_jobs": len(jobs),
    }


@router.get("/summary")
async def summary(business: dict = Depends(get_current_business)):
    m = await _metrics(business["id"])
    return {"business": {"name": business["name"], "industry": business["industry"]}, "metrics": m}


@router.get("/next-best-action")
async def next_best_action(business: dict = Depends(get_current_business)):
    m = await _metrics(business["id"])
    # cache for 30 minutes
    cached = await db.nba_cache.find_one({"business_id": business["id"]}, NO_ID)
    if cached:
        age = datetime.now(timezone.utc) - datetime.fromisoformat(cached["created_at"])
        if age < timedelta(minutes=30):
            return {"actions": cached["actions"], "cached": True}

    system = ("You are the growth strategist inside Venturelyx, a business operating system. "
              "Given the owner's live metrics, output EXACTLY 3 'Next Best Actions'. "
              "Return a strict JSON array of objects with keys: title (max 6 words), "
              "why (one plain-English sentence), impact ('High'|'Medium'|'Low'), module "
              "('ScaleSEO'|'Operate'|'Reviews'). No prose, no markdown, JSON only.")
    prompt = (f"Business: {business['name']} ({business['industry']}), area: {business.get('service_area') or 'local'}.\n"
              f"Metrics: growth_score={m['growth_score']}, seo_score={m['seo_score']}, open_leads={m['open_leads']}, "
              f"pipeline=${m['pipeline_value']}, revenue=${m['revenue']}, outstanding=${m['outstanding']}, "
              f"customers={m['customers']}, rating={m['rating']} from {m['review_count']} reviews, "
              f"upcoming_jobs={m['upcoming_jobs']}.\nReturn the JSON array now.")
    out = await ai_service.generate_text("next_best_action", system, prompt,
                                         business_id=business["id"], preference=business.get("ai_preference", "auto"))
    import json, re
    actions = []
    text = out.get("text", "")
    match = re.search(r"\[.*\]", text, re.S)
    if match:
        try:
            actions = json.loads(match.group(0))
        except Exception:
            actions = []
    if not actions:
        actions = _fallback_actions(m)
    await db.nba_cache.update_one({"business_id": business["id"]},
                                  {"$set": {"business_id": business["id"], "actions": actions,
                                            "created_at": now_iso()}}, upsert=True)
    return {"actions": actions, "cached": False, "model": out.get("model_name")}


def _fallback_actions(m):
    acts = []
    if m["seo_score"] < 80:
        acts.append({"title": "Fix your SEO issues", "why": "Your website has issues stopping customers from finding you.", "impact": "High", "module": "ScaleSEO"})
    if m["open_leads"] > 0:
        acts.append({"title": "Follow up open leads", "why": f"You have {m['open_leads']} leads waiting for a response.", "impact": "High", "module": "Operate"})
    if m["review_count"] < 10:
        acts.append({"title": "Request more reviews", "why": "More 5-star reviews build trust and rankings.", "impact": "Medium", "module": "Reviews"})
    return acts[:3] or [{"title": "Add your first leads", "why": "Start tracking customers in your pipeline.", "impact": "High", "module": "Operate"}]


@router.get("/ai-usage")
async def ai_usage(business: dict = Depends(get_current_business)):
    rows = await db.ai_usage.find({"business_id": business["id"]}, NO_ID).to_list(2000)
    by_provider = {}
    for r in rows:
        p = r["provider"]
        by_provider.setdefault(p, {"calls": 0, "tokens": 0})
        by_provider[p]["calls"] += 1
        by_provider[p]["tokens"] += r.get("approx_tokens", 0)
    return {"total_calls": len(rows), "by_provider": by_provider}
