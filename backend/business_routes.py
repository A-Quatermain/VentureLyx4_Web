"""Business onboarding + settings routes."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from core import db, NO_ID, new_id, now_iso, get_current_user, get_current_business

router = APIRouter(prefix="/api", tags=["business"])

INDUSTRIES = ["Home Services", "Cleaning", "Landscaping", "HVAC", "Pool Service",
              "Contractor", "Salon & Spa", "Restaurant", "Retail", "E-commerce",
              "Professional Services", "Health & Wellness", "Automotive", "Other"]


class OnboardIn(BaseModel):
    name: str = Field(min_length=1)
    website: Optional[str] = ""
    industry: str = "Other"
    service_area: Optional[str] = ""


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    service_area: Optional[str] = None
    ai_preference: Optional[str] = None  # auto | claude | gpt


@router.get("/industries")
async def industries():
    return {"industries": INDUSTRIES}


@router.post("/business/onboard")
async def onboard(body: OnboardIn, user: dict = Depends(get_current_user)):
    existing = await db.businesses.find_one({"org_id": user["org_id"]}, NO_ID)
    if existing:
        return existing
    doc = {
        "id": new_id(),
        "org_id": user["org_id"],
        "owner_id": user["id"],
        "name": body.name.strip(),
        "website": (body.website or "").strip(),
        "industry": body.industry,
        "service_area": (body.service_area or "").strip(),
        "ai_preference": "auto",
        "created_at": now_iso(),
    }
    await db.businesses.insert_one(doc)
    return await db.businesses.find_one({"id": doc["id"]}, NO_ID)


@router.get("/business")
async def get_business(business: dict = Depends(get_current_business)):
    return business


@router.put("/business")
async def update_business(body: BusinessUpdate, business: dict = Depends(get_current_business)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.businesses.update_one({"id": business["id"]}, {"$set": updates})
    return await db.businesses.find_one({"id": business["id"]}, NO_ID)
