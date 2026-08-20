"""OPERATE module: leads pipeline, customers, jobs, invoices."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from core import db, NO_ID, new_id, now_iso, get_current_business

router = APIRouter(prefix="/api/operate", tags=["operate"])

STAGES = ["new", "contacted", "quoted", "won", "lost"]


class LeadIn(BaseModel):
    name: str = Field(min_length=1)
    email: Optional[str] = ""
    phone: Optional[str] = ""
    source: Optional[str] = "Manual"
    value: float = 0
    stage: str = "new"
    notes: Optional[str] = ""


class StageIn(BaseModel):
    stage: str


class CustomerIn(BaseModel):
    name: str = Field(min_length=1)
    email: Optional[str] = ""
    phone: Optional[str] = ""
    notes: Optional[str] = ""


class JobIn(BaseModel):
    title: str = Field(min_length=1)
    customer_name: Optional[str] = ""
    scheduled_at: Optional[str] = ""
    status: str = "scheduled"  # scheduled | in_progress | done
    notes: Optional[str] = ""


class InvoiceIn(BaseModel):
    customer_name: str = Field(min_length=1)
    customer_email: Optional[str] = ""
    description: str = "Services"
    amount: float = Field(gt=0)


# ---------- Leads ----------
@router.get("/leads")
async def list_leads(business: dict = Depends(get_current_business)):
    leads = await db.leads.find({"business_id": business["id"]}, NO_ID).sort("created_at", -1).to_list(500)
    return leads


@router.post("/leads")
async def create_lead(body: LeadIn, business: dict = Depends(get_current_business)):
    if body.stage not in STAGES:
        raise HTTPException(400, "Invalid stage")
    doc = {"id": new_id(), "business_id": business["id"], **body.model_dump(), "created_at": now_iso()}
    await db.leads.insert_one(doc)
    return await db.leads.find_one({"id": doc["id"]}, NO_ID)


@router.put("/leads/{lead_id}/stage")
async def move_lead(lead_id: str, body: StageIn, business: dict = Depends(get_current_business)):
    if body.stage not in STAGES:
        raise HTTPException(400, "Invalid stage")
    res = await db.leads.update_one({"id": lead_id, "business_id": business["id"]}, {"$set": {"stage": body.stage}})
    if res.matched_count == 0:
        raise HTTPException(404, "Lead not found")
    return await db.leads.find_one({"id": lead_id}, NO_ID)


@router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, business: dict = Depends(get_current_business)):
    await db.leads.delete_one({"id": lead_id, "business_id": business["id"]})
    return {"ok": True}


# ---------- Customers ----------
@router.get("/customers")
async def list_customers(business: dict = Depends(get_current_business)):
    return await db.customers.find({"business_id": business["id"]}, NO_ID).sort("created_at", -1).to_list(500)


@router.post("/customers")
async def create_customer(body: CustomerIn, business: dict = Depends(get_current_business)):
    doc = {"id": new_id(), "business_id": business["id"], **body.model_dump(), "created_at": now_iso()}
    await db.customers.insert_one(doc)
    return await db.customers.find_one({"id": doc["id"]}, NO_ID)


# ---------- Jobs ----------
@router.get("/jobs")
async def list_jobs(business: dict = Depends(get_current_business)):
    return await db.jobs.find({"business_id": business["id"]}, NO_ID).sort("created_at", -1).to_list(500)


@router.post("/jobs")
async def create_job(body: JobIn, business: dict = Depends(get_current_business)):
    doc = {"id": new_id(), "business_id": business["id"], **body.model_dump(), "created_at": now_iso()}
    await db.jobs.insert_one(doc)
    return await db.jobs.find_one({"id": doc["id"]}, NO_ID)


@router.put("/jobs/{job_id}")
async def update_job(job_id: str, body: JobIn, business: dict = Depends(get_current_business)):
    res = await db.jobs.update_one({"id": job_id, "business_id": business["id"]}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Job not found")
    return await db.jobs.find_one({"id": job_id}, NO_ID)


# ---------- Invoices ----------
@router.get("/invoices")
async def list_invoices(business: dict = Depends(get_current_business)):
    return await db.invoices.find({"business_id": business["id"]}, NO_ID).sort("created_at", -1).to_list(500)


@router.post("/invoices")
async def create_invoice(body: InvoiceIn, business: dict = Depends(get_current_business)):
    count = await db.invoices.count_documents({"business_id": business["id"]})
    doc = {
        "id": new_id(),
        "business_id": business["id"],
        "number": f"INV-{1001 + count}",
        **body.model_dump(),
        "status": "unpaid",
        "session_id": None,
        "created_at": now_iso(),
    }
    await db.invoices.insert_one(doc)
    return await db.invoices.find_one({"id": doc["id"]}, NO_ID)
