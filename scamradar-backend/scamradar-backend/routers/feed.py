from fastapi import APIRouter, Query
from core.database import get_db
from datetime import datetime, timezone

router = APIRouter()

# ── Get live feed of reports ──
@router.get("/feed")
async def get_feed(
    tab: str = Query("latest"),   # latest | trending | high-risk
    tag: str = Query(None),
    limit: int = Query(10),
    skip: int = Query(0)
):
    db = get_db()

    # Build filter
    match = {"status": "active"}
    if tag:
        match["tags"] = {"$elemMatch": {"$regex": tag, "$options": "i"}}

    # Sort based on tab
    sort_field = "created_at"
    sort_dir = -1

    if tab == "trending":
        sort_field = "reaction_count"
    elif tab == "high-risk":
        match["has_high_risk_entity"] = True

    reports = []
    cursor = db.reports.find(match).sort(sort_field, sort_dir).skip(skip).limit(limit)

    async for report in cursor:
        report["_id"] = str(report["_id"])

        # Attach entity info to each report
        entity_info = []
        for entity_val in [e["value"] for e in report.get("entities", [])[:1]]:
            entity = await db.entities.find_one({"value": entity_val})
            if entity:
                entity_info.append({
                    "value": entity.get("value"),
                    "type": entity.get("type"),
                    "report_count": entity.get("report_count", 0),
                })

        report["entity_info"] = entity_info
        report["time_ago"] = time_ago(report.get("created_at"))
        reports.append(report)

    total = await db.reports.count_documents(match)
    return {"reports": reports, "total": total, "tab": tab}

# ── React to a report ──
@router.post("/feed/{report_id}/react")
async def react_to_report(report_id: str, emoji: str):
    db = get_db()
    from bson import ObjectId
    try:
        await db.reports.update_one(
            {"_id": ObjectId(report_id)},
            {
                "$inc": {
                    f"reactions.{emoji}": 1,
                    "reaction_count": 1
                }
            }
        )
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ── Add comment to a report ──
@router.post("/feed/{report_id}/comment")
async def add_comment(report_id: str, text: str):
    db = get_db()
    from bson import ObjectId
    import random
    import string

    # Generate anonymous username
    adjectives = ["Silent", "Ghost", "Night", "Iron", "Void", "Brave", "Alert", "Quiet"]
    animals    = ["Fox", "Owl", "Hawk", "Wolf", "Eagle", "Tiger", "Bear", "Storm"]
    anon_name  = f"{random.choice(adjectives)}{random.choice(animals)}#{''.join(random.choices(string.digits, k=4))}"

    comment = {
        "anon": anon_name,
        "text": text,
        "created_at": datetime.now(timezone.utc)
    }

    try:
        await db.reports.update_one(
            {"_id": ObjectId(report_id)},
            {"$push": {"comments": comment}, "$inc": {"comment_count": 1}}
        )
        return {"success": True, "anon": anon_name}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ── Helper: human-readable time ──
def time_ago(dt: datetime) -> str:
    if not dt:
        return "recently"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    diff = (datetime.now(timezone.utc) - dt).total_seconds()
    if diff < 60:     return "just now"
    if diff < 3600:   return f"{int(diff/60)} minutes ago"
    if diff < 86400:  return f"{int(diff/3600)} hours ago"
    if diff < 604800: return f"{int(diff/86400)} days ago"
    return f"{int(diff/604800)} weeks ago"

    # ── Get comments for a report ──
@router.get("/feed/{report_id}/comments")
async def get_comments(report_id: str):
    db = get_db()
    from bson import ObjectId
    try:
        report = await db.reports.find_one(
            {"_id": ObjectId(report_id)},
            {"comments": 1}
        )
        if not report:
            return {"comments": []}
        
        comments = report.get("comments", [])
        # Format datetime for frontend
        for c in comments:
            if "created_at" in c:
                c["created_at"] = time_ago(c["created_at"])
        return {"comments": comments}
    except:
        return {"comments": []}
