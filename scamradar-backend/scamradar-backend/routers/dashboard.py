from fastapi import APIRouter
from core.database import get_db
from services.entity_service import format_entity, REPORT_THRESHOLD

router = APIRouter()

@router.get("/dashboard/stats")
async def get_stats():
    db = get_db()

    total_reports   = await db.reports.count_documents({"status": "active"})
    total_entities  = await db.entities.count_documents({"report_count": {"$gte": REPORT_THRESHOLD}})
    high_risk       = await db.entities.count_documents({"risk_score": {"$gte": 60}, "report_count": {"$gte": REPORT_THRESHOLD}})
    with_complaint  = await db.reports.count_documents({"has_police_complaint": True})

    # Total reported losses
    pipeline = [
        {"$match": {"status": "active", "amount_lost": {"$gt": 0}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_lost"}}}
    ]
    loss_result = await db.reports.aggregate(pipeline).to_list(1)
    total_loss = loss_result[0]["total"] if loss_result else 0

    # Scam type breakdown
    type_pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$scam_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 8}
    ]
    scam_types = await db.reports.aggregate(type_pipeline).to_list(8)

    return {
        "total_reports": total_reports,
        "total_entities": total_entities,
        "high_risk_entities": high_risk,
        "total_reported_loss": total_loss,
        "reports_with_police_complaint": with_complaint,
        "scam_type_breakdown": [
            {"type": s["_id"], "count": s["count"]} for s in scam_types if s["_id"]
        ]
    }

@router.get("/dashboard/top-flagged")
async def get_top_flagged(limit: int = 5):
    db = get_db()
    entities = []
    cursor = db.entities.find(
        {"report_count": {"$gte": REPORT_THRESHOLD}}
    ).sort("risk_score", -1).limit(limit)

    async for entity in cursor:
        entities.append(format_entity(entity))

    return {"entities": entities}

@router.get("/dashboard/reports")
async def get_all_reports(
    entity_type: str = None,
    limit: int = 20,
    skip: int = 0
):
    db = get_db()
    match = {"status": "active"}

    reports = []
    cursor = db.reports.find(match).sort("created_at", -1).skip(skip).limit(limit)

    async for report in cursor:
        report["_id"] = str(report["_id"])
        reports.append(report)

    total = await db.reports.count_documents(match)
    return {"reports": reports, "total": total}
