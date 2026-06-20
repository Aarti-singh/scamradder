from fastapi import APIRouter, Query, HTTPException
from core.database import get_db
from services.entity_service import format_entity, REPORT_THRESHOLD
from bson import ObjectId
from typing import Optional
import re

router = APIRouter()

# ── Search entities by value ──
@router.get("/search")
async def search(
    query: str = Query(..., min_length=1),
    entity_type: Optional[str] = Query(None),  # phone, email, upi, url
    limit: int = 20
):
    db = get_db()
    q = query.lower().strip()

    # Build search conditions
    search_conditions = [
        {"value": {"$regex": re.escape(q), "$options": "i"}},
        {"tags": {"$elemMatch": {"$regex": re.escape(q), "$options": "i"}}},
    ]

    mongo_query = {"$or": search_conditions}

    # Optional type filter
    if entity_type:
        mongo_query["type"] = entity_type.lower()

    entities = []
    cursor = db.entities.find(mongo_query).sort("report_count", -1).limit(limit)

    async for entity in cursor:
        formatted = format_entity(entity)

        # ── Fetch up to 3 linked reports ──
        linked_reports = []
        raw_ids = entity.get("linked_report_ids", [])[:3]
        valid_ids = []
        for rid in raw_ids:
            try:
                valid_ids.append(ObjectId(rid))
            except:
                pass

        if valid_ids:
            lr_cursor = db.reports.find(
                {"_id": {"$in": valid_ids}},
                {"description": 1, "scam_type": 1, "platform": 1,
                 "amount_lost": 1, "created_at": 1, "has_police_complaint": 1}
            ).limit(3)
            async for lr in lr_cursor:
                lr["_id"] = str(lr["_id"])
                linked_reports.append(lr)

        formatted["linked_reports"] = linked_reports
        entities.append(formatted)

    return {
        "query": query,
        "entity_type_filter": entity_type,
        "results": entities,
        "total": len(entities),
        "message": "No reports found" if not entities else f"{len(entities)} result(s) found"
    }


# ── Get entity details by exact value ──
@router.get("/entity/{value}")
async def get_entity(value: str):
    db = get_db()
    entity = await db.entities.find_one({"value": value.lower().strip()})

    if not entity:
        return {
            "found": False,
            "value": value,
            "message": "No community reports found for this entity.",
            "display_level": "safe",
            "report_count": 0
        }

    formatted = format_entity(entity)
    formatted["found"] = True

    # ── Fetch all linked reports ──
    raw_ids = entity.get("linked_report_ids", [])
    valid_ids = []
    for rid in raw_ids:
        try:
            valid_ids.append(ObjectId(rid))
        except:
            pass

    linked_reports = []
    if valid_ids:
        lr_cursor = db.reports.find(
            {"_id": {"$in": valid_ids}, "status": "active"},
            {"description": 1, "scam_type": 1, "platform": 1,
             "amount_lost": 1, "created_at": 1, "has_police_complaint": 1}
        )
        async for lr in lr_cursor:
            lr["_id"] = str(lr["_id"])
            linked_reports.append(lr)

    formatted["linked_reports"] = linked_reports
    return formatted


# ── Popular entities (most reported) ──
@router.get("/popular")
async def get_popular(limit: int = 10):
    db = get_db()
    entities = []
    cursor = db.entities.find(
        {"report_count": {"$gte": REPORT_THRESHOLD}}
    ).sort("report_count", -1).limit(limit)

    async for entity in cursor:
        entities.append(format_entity(entity))

    return {"entities": entities, "total": len(entities)}


# ── Recently reported entities ──
@router.get("/recent-entities")
async def get_recent_entities(limit: int = 10):
    db = get_db()
    entities = []
    cursor = db.entities.find().sort("last_seen", -1).limit(limit)

    async for entity in cursor:
        entities.append(format_entity(entity))

    return {"entities": entities, "total": len(entities)}


# ── Stats summary ──
@router.get("/stats")
async def get_stats():
    db = get_db()
    total_reports = await db.reports.count_documents({"status": "active"})
    total_entities = await db.entities.count_documents({})
    high_risk = await db.entities.count_documents({"risk_score": {"$gte": 60}})
    with_complaint = await db.reports.count_documents({"has_police_complaint": True})

    return {
        "total_reports": total_reports,
        "total_entities": total_entities,
        "high_risk_entities": high_risk,
        "reports_with_complaint": with_complaint
    }