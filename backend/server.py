"""Venturelyx API server."""
import os
import logging
import random
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from core import db, new_id, now_iso, hash_password, verify_password

import auth_routes
import business_routes
import operate_routes
import seo_routes
import reviews_routes
import command_routes
import payment_routes

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("venturelyx")

app = FastAPI(title="Venturelyx API")

health = APIRouter(prefix="/api")


@health.get("/")
async def root():
    return {"message": "Venturelyx API", "status": "ok"}


app.include_router(health)
app.include_router(auth_routes.router)
app.include_router(business_routes.router)
app.include_router(operate_routes.router)
app.include_router(seo_routes.router)
app.include_router(reviews_routes.router)
app.include_router(command_routes.router)
app.include_router(payment_routes.router)

frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _iso_days_ago(days):
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


async def seed():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.businesses.create_index("org_id")
    await db.leads.create_index("business_id")
    await db.login_attempts.create_index("identifier")

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        org_id = new_id()
        uid = new_id()
        await db.orgs.insert_one({"id": org_id, "name": "Bright Spark Home Services", "created_at": now_iso()})
        await db.users.insert_one({
            "id": uid, "org_id": org_id, "email": admin_email, "name": "Sara",
            "role": "owner", "password_hash": hash_password(admin_password), "created_at": now_iso(),
        })
        await _seed_demo(org_id, uid)
        logger.info("Seeded admin owner + demo business.")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Updated admin password.")


async def _seed_demo(org_id, uid):
    bid = new_id()
    await db.businesses.insert_one({
        "id": bid, "org_id": org_id, "owner_id": uid,
        "name": "Bright Spark Home Services", "website": "https://example.com",
        "industry": "Home Services", "service_area": "Austin, TX",
        "ai_preference": "auto", "created_at": now_iso(),
    })

    stages = ["new", "contacted", "quoted", "won", "lost"]
    names = ["Marcus Reed", "Priya Nair", "Tom Callahan", "Elena Vasquez", "Jordan Blake",
             "Aisha Khan", "David Okafor", "Nina Petrova", "Liam O'Brien", "Grace Chen"]
    for i, nm in enumerate(names):
        await db.leads.insert_one({
            "id": new_id(), "business_id": bid, "name": nm,
            "email": nm.lower().replace(" ", ".").replace("'", "") + "@email.com",
            "phone": f"+1 512-555-{1000+i:04d}", "source": random.choice(["Google", "Referral", "Website", "Facebook"]),
            "value": random.choice([450, 800, 1200, 2500, 3200, 600, 1750]),
            "stage": stages[i % 5], "notes": "", "created_at": await _iso_days_ago(random.randint(1, 40)),
        })

    for nm in names[:5]:
        await db.customers.insert_one({
            "id": new_id(), "business_id": bid, "name": nm,
            "email": nm.lower().replace(" ", ".").replace("'", "") + "@email.com",
            "phone": "+1 512-555-9000", "notes": "", "created_at": await _iso_days_ago(random.randint(10, 90)),
        })

    jobs = [("AC tune-up — Reed residence", "Marcus Reed", "scheduled"),
            ("Water heater install — Nair", "Priya Nair", "in_progress"),
            ("Duct cleaning — Callahan", "Tom Callahan", "done"),
            ("Thermostat upgrade — Vasquez", "Elena Vasquez", "scheduled")]
    for title, cust, st in jobs:
        await db.jobs.insert_one({
            "id": new_id(), "business_id": bid, "title": title, "customer_name": cust,
            "scheduled_at": await _iso_days_ago(random.randint(-7, 5)), "status": st,
            "notes": "", "created_at": await _iso_days_ago(random.randint(1, 20)),
        })

    invs = [("Marcus Reed", "AC tune-up", 189.0, "paid"),
            ("Tom Callahan", "Duct cleaning", 340.0, "paid"),
            ("Priya Nair", "Water heater install", 1450.0, "unpaid")]
    for i, (cust, desc, amt, stt) in enumerate(invs):
        await db.invoices.insert_one({
            "id": new_id(), "business_id": bid, "number": f"INV-{1001+i}",
            "customer_name": cust, "customer_email": "", "description": desc, "amount": amt,
            "status": stt, "session_id": None, "created_at": await _iso_days_ago(random.randint(2, 30)),
        })

    revs = [("Marcus Reed", 5, "Fantastic service, showed up on time and fixed everything.", "Google"),
            ("Elena Vasquez", 5, "Very professional and friendly. Highly recommend!", "Google"),
            ("Tom Callahan", 4, "Good work, slightly pricey but worth it.", "Google"),
            ("Jordan Blake", 2, "Waited two hours past the window. Work was okay.", "Yelp"),
            ("Aisha Khan", 5, "Best HVAC company in Austin, hands down.", "Google")]
    for i, (au, ra, tx, src) in enumerate(revs):
        await db.reviews.insert_one({
            "id": new_id(), "business_id": bid, "author": au, "rating": ra, "text": tx, "source": src,
            "ai_response": None, "response_status": "none", "created_at": await _iso_days_ago(random.randint(3, 150)),
        })

    for term in ["hvac repair austin", "ac installation austin tx", "emergency furnace repair"]:
        await db.keywords.insert_one({
            "id": new_id(), "business_id": bid, "term": term, "location": "Austin, TX",
            "rank": random.randint(4, 30), "prev_rank": random.randint(6, 40),
            "volume": random.choice([320, 480, 720]), "created_at": now_iso(),
        })

    for nm in ["CoolAir Pros", "Lone Star HVAC"]:
        await db.competitors.insert_one({
            "id": new_id(), "business_id": bid, "name": nm, "website": "",
            "seo_score": random.randint(60, 90), "reviews": random.randint(80, 300),
            "rating": round(random.uniform(4.0, 4.8), 1), "created_at": now_iso(),
        })


@app.on_event("startup")
async def on_startup():
    try:
        await seed()
    except Exception as e:
        logger.error(f"Seed error: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    from core import client
    client.close()
