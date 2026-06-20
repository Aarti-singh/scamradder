from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone
from core.database import get_db
import random
import string

router = APIRouter()

class DisputeRequest(BaseModel):
    entity_value: str
    name: str
    email: str
    reason: str
    statement: str
    evidence: str = None

@router.post("/dispute")
async def submit_dispute(data: DisputeRequest):
    db = get_db()

    # Generate ticket ID
    ticket_id = "SR-DISPUTE-" + "".join(random.choices(string.digits, k=5))

    dispute = {
        "ticket_id": ticket_id,
        "entity_value": data.entity_value.lower().strip(),
        "name": data.name,
        "email": data.email,
        "reason": data.reason,
        "statement": data.statement,
        "evidence": data.evidence,
        "status": "under_review",
        "created_at": datetime.now(timezone.utc),
    }

    await db.disputes.insert_one(dispute)

    # Mark entity as disputed
    await db.entities.update_one(
        {"value": data.entity_value.lower().strip()},
        {"$set": {
            "disputed": True,
            "dispute_note": "The owner of this entity has disputed these reports. ScamRadar is reviewing. This is unverified community data."
        }}
    )

    return {
        "success": True,
        "ticket_id": ticket_id,
        "message": "Dispute received. Our team will review within 72 hours.",
        "entity": data.entity_value
    }

@router.get("/dispute/{ticket_id}")
async def get_dispute_status(ticket_id: str):
    db = get_db()
    dispute = await db.disputes.find_one({"ticket_id": ticket_id})
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    dispute["_id"] = str(dispute["_id"])
    return dispute
