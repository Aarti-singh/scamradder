from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
from core.database import get_db
from services.ocr_service import upload_screenshot, extract_entities_from_image
from services.entity_service import upsert_entity

router = APIRouter()

# ── Submit a new scam report ──
@router.post("/reports")
async def submit_report(
    description: str = Form(...),
    scam_type: str = Form(...),
    platform: str = Form(...),
    amount_lost: Optional[float] = Form(0),
    complaint_number: Optional[str] = Form(None),
    entities: Optional[str] = Form(None),  # JSON string of entities
    screenshot: Optional[UploadFile] = File(None),
):
    db = get_db()

    # ── Upload screenshot if provided ──
    screenshot_url = None
    ocr_entities = {"phones": [], "upis": [], "emails": []}

    if screenshot and screenshot.filename:
        file_bytes = await screenshot.read()
        # Upload to Cloudinary
        filename = f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        screenshot_url = await upload_screenshot(file_bytes, filename)
        # Run OCR
        ocr_entities = await extract_entities_from_image(file_bytes)

    # ── Parse manually entered entities ──
    manual_entities = []
    if entities:
        import json
        try:
            manual_entities = json.loads(entities)
        except:
            pass

    # ── Merge OCR + manual entities ──
    all_entities = []
    for phone in ocr_entities.get("phones", []):
        all_entities.append({"type": "phone", "value": phone})
    for upi in ocr_entities.get("upis", []):
        all_entities.append({"type": "upi", "value": upi})
    for email in ocr_entities.get("emails", []):
        all_entities.append({"type": "email", "value": email})
    all_entities.extend(manual_entities)

    # Remove duplicates
    seen = set()
    unique_entities = []
    for e in all_entities:
        key = f"{e['type']}:{e['value'].lower()}"
        if key not in seen:
            seen.add(key)
            unique_entities.append(e)

    # ── Create the report ──
    tags = [scam_type, platform]
    report = {
        "description": description,
        "scam_type": scam_type,
        "platform": platform,
        "amount_lost": amount_lost or 0,
        "complaint_number": complaint_number,
        "has_police_complaint": bool(complaint_number and complaint_number.strip()),
        "screenshot_url": screenshot_url,
        "ocr_raw_text": ocr_entities.get("raw_text", ""),
        "entities": unique_entities,
        "entity_ids": [],
        "tags": tags,
        "created_at": datetime.now(timezone.utc),
        "status": "active",
    }

    result = await db.reports.insert_one(report)
    report_id = str(result.inserted_id)

    # ── Upsert each entity in database ──
    entity_ids = []
    for entity in unique_entities:
        entity_id = await upsert_entity(
            value=entity["value"],
            entity_type=entity["type"],
            tags=tags,
            report_id=report_id
        )
        entity_ids.append(entity_id)

    # Update report with entity IDs
    await db.reports.update_one(
        {"_id": ObjectId(report_id)},
        {"$set": {"entity_ids": entity_ids}}
    )

    return {
        "success": True,
        "report_id": report_id,
        "message": "Report submitted successfully",
        "entities_extracted": len(unique_entities),
        "ocr_extracted": {
            "phones": ocr_entities.get("phones", []),
            "upis": ocr_entities.get("upis", []),
            "emails": ocr_entities.get("emails", []),
        },
        "has_police_complaint": bool(complaint_number)
    }

# ── Get a single report by ID ──
@router.get("/reports/{report_id}")
async def get_report(report_id: str):
    db = get_db()
    try:
        report = await db.reports.find_one({"_id": ObjectId(report_id)})
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        report["_id"] = str(report["_id"])
        return report
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ── Get recent reports (for home page) ──
@router.get("/reports")
async def get_reports(limit: int = 10, skip: int = 0):
    db = get_db()
    reports = []
    cursor = db.reports.find(
        {"status": "active"}
    ).sort("created_at", -1).skip(skip).limit(limit)

    async for report in cursor:
        report["_id"] = str(report["_id"])
        reports.append(report)

    total = await db.reports.count_documents({"status": "active"})
    return {"reports": reports, "total": total}

    # ── Get reports by entity value (phone/email/UPI) ──
@router.get("/reports/entity/{value}")
async def get_reports_by_entity(value: str, limit: int = 10, skip: int = 0):
    db = get_db()
    value = value.lower().strip()

    # Find the entity first
    entity = await db.entities.find_one({"value": value})
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    # Get all reports linked to this entity
    reports = []
    cursor = db.reports.find(
        {"entities.value": value, "status": "active"}
    ).sort("created_at", -1).skip(skip).limit(limit)

    async for report in cursor:
        report["_id"] = str(report["_id"])
        reports.append(report)

    total = await db.reports.count_documents(
        {"entities.value": value, "status": "active"}
    )

    from services.entity_service import format_entity
    return {
        "entity": format_entity(entity),
        "reports": reports,
        "total": total
    }


# ── Filter reports by scam_type / platform ──
@router.get("/reports/filter/search")
async def filter_reports(
    scam_type: Optional[str] = None,
    platform: Optional[str] = None,
    limit: int = 10,
    skip: int = 0
):
    db = get_db()
    query = {"status": "active"}

    if scam_type:
        query["scam_type"] = scam_type
    if platform:
        query["platform"] = platform

    reports = []
    cursor = db.reports.find(query).sort("created_at", -1).skip(skip).limit(limit)

    async for report in cursor:
        report["_id"] = str(report["_id"])
        reports.append(report)

    total = await db.reports.count_documents(query)
    return {"reports": reports, "total": total}


# ── Delete a report (soft delete) ──
@router.delete("/reports/{report_id}")
async def delete_report(report_id: str):
    db = get_db()
    try:
        result = await db.reports.update_one(
            {"_id": ObjectId(report_id)},
            {"$set": {"status": "deleted"}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Report not found")
        return {"success": True, "message": "Report deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

        # ── OCR Preview endpoint ──
@router.post("/ocr/preview")
async def ocr_preview(screenshot: UploadFile = File(...)):
    from services.ocr_service import extract_entities_from_image
    try:
        file_bytes = await screenshot.read()
        entities = await extract_entities_from_image(file_bytes)
        return {
            "phones": entities.get("phones", []),
            "upis": entities.get("upis", []),
            "emails": entities.get("emails", []),
            "raw_text": entities.get("raw_text", "")
        }
    except Exception as e:
        return {"phones": [], "upis": [], "emails": [], "raw_text": ""}
