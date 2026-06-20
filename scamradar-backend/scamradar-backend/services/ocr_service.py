import os
import re
import base64
import httpx
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

load_dotenv()

# ── Configure Cloudinary ──
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

# ── Upload screenshot to Cloudinary ──
async def upload_screenshot(file_bytes: bytes, filename: str) -> str:
    """Upload image to Cloudinary and return public URL"""
    try:
        result = cloudinary.uploader.upload(
            file_bytes,
            folder="scamradar/screenshots",
            public_id=filename,
            resource_type="image"
        )
        return result.get("secure_url", "")
    except Exception as e:
        print(f"Cloudinary upload error: {e}")
        return ""

# ── Extract entities using Google Vision OCR ──
async def extract_entities_from_image(image_bytes: bytes) -> dict:
    """
    Send image to OCR.space API (free) and extract
    phone numbers, UPI IDs, and emails from the text
    """
    try:
        # Encode image to base64
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        # Call OCR.space free API
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.ocr.space/parse/image",
                data={
                    "apikey": "helloworld",  # Free tier key
                    "base64Image": f"data:image/jpeg;base64,{image_b64}",
                    "language": "eng",
                    "isOverlayRequired": False,
                    "detectOrientation": True,
                    "scale": True,
                    "OCREngine": 2
                }
            )
            data = response.json()

        # Extract raw text
        raw_text = ""
        if data.get("ParsedResults"):
            raw_text = data["ParsedResults"][0].get("ParsedText", "")

        if not raw_text:
            return {"phones": [], "upis": [], "emails": [], "raw_text": ""}

        # Extract entities using regex
        entities = extract_entities_from_text(raw_text)
        entities["raw_text"] = raw_text
        return entities

    except Exception as e:
        print(f"OCR error: {e}")
        return {"phones": [], "upis": [], "emails": [], "raw_text": ""}
    """
    Send image to Google Vision API and extract
    phone numbers, UPI IDs, and emails from the text
    """
    api_key = os.getenv("GOOGLE_VISION_API_KEY")

    if not api_key or api_key == "your_google_vision_api_key_here":
        # Fallback: return empty if no API key configured
        return {"phones": [], "upis": [], "emails": [], "raw_text": ""}

    try:
        # Encode image to base64
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        # Call Google Vision API
        url = f"https://vision.googleapis.com/v1/images:annotate?key={api_key}"
        payload = {
            "requests": [{
                "image": {"content": image_b64},
                "features": [{"type": "TEXT_DETECTION", "maxResults": 1}]
            }]
        }

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, json=payload)
            data = response.json()

        # Extract raw text
        raw_text = ""
        responses = data.get("responses", [])
        if responses and "fullTextAnnotation" in responses[0]:
            raw_text = responses[0]["fullTextAnnotation"]["text"]

        # Extract entities using regex
        entities = extract_entities_from_text(raw_text)
        entities["raw_text"] = raw_text
        return entities

    except Exception as e:
        print(f"OCR error: {e}")
        return {"phones": [], "upis": [], "emails": [], "raw_text": ""}

# ── Extract entities from plain text using regex ──
def extract_entities_from_text(text: str) -> dict:
    """Extract phone numbers, UPI IDs and emails from text"""

    # Indian phone numbers: 10 digits, optionally starting with +91 or 0
    phone_pattern = r'(?:(?:\+91|91|0)?[\s\-]?)?[6-9]\d{9}'
    phones = list(set(re.findall(phone_pattern, text)))
    # Clean up — keep only 10-digit numbers
    phones = [re.sub(r'[\s\-]', '', p)[-10:] for p in phones if len(re.sub(r'[\s\-]', '', p)) >= 10]

    # UPI IDs: something@bankname
    upi_pattern = r'[a-zA-Z0-9._\-]+@[a-zA-Z0-9]+(?:\.[a-zA-Z]+)?'
    potential_upis = re.findall(upi_pattern, text)
    upi_handles = ['okaxis', 'oksbi', 'okicici', 'okhdfcbank', 'ybl', 'paytm',
                   'upi', 'apl', 'ibl', 'axl', 'barodampay', 'centralbank',
                   'cnrb', 'freecharge', 'hsbc', 'imobile', 'indus', 'jupiteraxis']
    upis = [u for u in potential_upis if any(handle in u.lower() for handle in upi_handles)]

    # Email addresses
    email_pattern = r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b'
    all_emails = re.findall(email_pattern, text)
    # Filter out UPIs from emails
    emails = [e for e in all_emails if not any(handle in e.lower() for handle in upi_handles)]

    return {
        "phones": phones[:5],  # Max 5 of each
        "upis": upis[:5],
        "emails": emails[:5]
    }
