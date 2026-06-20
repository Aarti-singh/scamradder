from datetime import datetime, timezone
from core.database import get_db

REPORT_THRESHOLD = 3  # Min reports before entity is publicly visible

# ── Compute decayed confidence score ──
def compute_decayed_score(raw_score: float, last_seen: datetime) -> float:
    if not last_seen:
        return raw_score
    last_seen_aware = last_seen.replace(tzinfo=timezone.utc) if last_seen.tzinfo is None else last_seen
    days = (datetime.now(timezone.utc) - last_seen_aware).days
    if days < 30:   return raw_score
    if days < 90:   return round(raw_score * 0.90, 1)
    if days < 180:  return round(raw_score * 0.75, 1)
    if days < 365:  return round(raw_score * 0.50, 1)
    return round(raw_score * 0.25, 1)

# ── Get display level from score ──
def get_level(score: float) -> str:
    if score >= 60: return "high"
    if score >= 35: return "medium"
    return "low"

# ── Format entity for API response ──
def format_entity(entity: dict) -> dict:
    raw_score = entity.get("risk_score", 0)
    last_seen = entity.get("last_seen")
    display_score = compute_decayed_score(raw_score, last_seen)
    report_count = entity.get("report_count", 0)

    return {
        "id": str(entity.get("_id", "")),
        "value": entity.get("value", ""),
        "type": entity.get("type", ""),
        "report_count": report_count,
        "display_score": display_score,
        "display_level": get_level(display_score),
        "tags": entity.get("tags", []),
        "first_seen": entity.get("first_seen"),
        "last_seen": last_seen,
        "description": entity.get("description", ""),
        "disputed": entity.get("disputed", False),
        "dispute_note": entity.get("dispute_note"),
        "below_threshold": report_count < REPORT_THRESHOLD,
        "is_decayed": (datetime.now(timezone.utc) - (last_seen.replace(tzinfo=timezone.utc) if last_seen.tzinfo is None else last_seen)).days >= 90 if last_seen else False,
    }

# ── Find or create entity, update report count ──
async def upsert_entity(value: str, entity_type: str, tags: list, report_id: str) -> str:
    db = get_db()
    value = value.lower().strip()

    existing = await db.entities.find_one({"value": value})

    if existing:
        # Update existing entity
        report_count = existing.get("report_count", 0) + 1
        risk_score = min(95, existing.get("risk_score", 0) + (10 if report_count <= 5 else 5))

        await db.entities.update_one(
            {"value": value},
            {"$set": {
                "report_count": report_count,
                "risk_score": risk_score,
                "last_seen": datetime.now(timezone.utc),
                "tags": list(set(existing.get("tags", []) + tags)),
            },
            "$push": {"linked_report_ids": report_id}}
        )
        return str(existing["_id"])
    else:
        # Create new entity
        new_entity = {
            "value": value,
            "type": entity_type,
            "report_count": 1,
            "risk_score": 25,  # Start low — needs more reports to rise
            "tags": tags,
            "first_seen": datetime.now(timezone.utc),
            "last_seen": datetime.now(timezone.utc),
            "description": f"Reported by 1 community member.",
            "disputed": False,
            "dispute_note": None,
            "linked_report_ids": [report_id],
        }
        result = await db.entities.insert_one(new_entity)
        return str(result.inserted_id)
