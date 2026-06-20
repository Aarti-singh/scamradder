# ScamRadar Backend — Complete Setup Guide

## STEP 1 — Create your .env file

Create a file called `.env` in the scamradar-backend folder with this content:

```
MONGODB_URL=mongodb+srv://scamradar_admin:ScamRadar@2025#Secure@scamradar-admin.xxxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Scamradar-admin
DB_NAME=scamradar
CLOUDINARY_CLOUD_NAME=dv7wqy6mf
CLOUDINARY_API_KEY=458526294244118
CLOUDINARY_API_SECRET=bRYsg8-98LrdLhqsb_6KNARM0UI
GOOGLE_VISION_API_KEY=your_key_here
ENVIRONMENT=development
```

Replace the MongoDB URL with your actual connection string.

---

## STEP 2 — Open terminal in VS Code

Open VS Code → Open Folder → select scamradar-backend folder
Then press Ctrl + ` (backtick) to open terminal

---

## STEP 3 — Create virtual environment

```bash
python -m venv venv
```

Activate it:
- Windows:  venv\Scripts\activate
- Mac/Linux: source venv/bin/activate

You should see (venv) at the start of your terminal line.

---

## STEP 4 — Install dependencies

```bash
pip install -r requirements.txt
```

Wait for all packages to install (~2 minutes)

---

## STEP 5 — Run the backend locally

```bash
uvicorn main:app --reload
```

You should see:
✅ Connected to MongoDB
INFO: Uvicorn running on http://127.0.0.1:8000

---

## STEP 6 — Test it works

Open your browser and go to:
http://127.0.0.1:8000

You should see: {"message": "ScamRadar API is live 🛡️"}

Then go to:
http://127.0.0.1:8000/docs

This shows you ALL your API endpoints with a testing UI.

---

## STEP 7 — Deploy to Render.com (make it live)

1. Go to github.com and create a new repository called scamradar-backend
2. In VS Code terminal run:

```bash
git init
git add .
git commit -m "ScamRadar backend initial commit"
git remote add origin https://github.com/YOUR_USERNAME/scamradar-backend.git
git push -u origin main
```

3. Go to render.com
4. Click "New" → "Web Service"
5. Connect your GitHub account
6. Select scamradar-backend repository
7. Fill in:
   - Name: scamradar-backend
   - Environment: Python
   - Build Command: pip install -r requirements.txt
   - Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT

8. Click "Add Environment Variables" and add:
   - MONGODB_URL = your full connection string
   - DB_NAME = scamradar
   - CLOUDINARY_CLOUD_NAME = dv7wqy6mf
   - CLOUDINARY_API_KEY = 458526294244118
   - CLOUDINARY_API_SECRET = bRYsg8-98LrdLhqsb_6KNARM0UI
   - ENVIRONMENT = production

9. Click "Create Web Service"

Render will build and deploy. Takes 3-5 minutes.
You'll get a URL like: https://scamradar-backend.onrender.com

---

## STEP 8 — Update your frontend

Once Render gives you the backend URL, open your frontend files
and replace the API_URL constant in assets/api.js with your Render URL.

---

## API Endpoints Summary

| Method | Endpoint | What it does |
|--------|----------|-------------|
| POST | /api/v1/reports | Submit a new scam report |
| GET | /api/v1/reports | Get recent reports |
| GET | /api/v1/search?query= | Search any entity |
| GET | /api/v1/popular | Get most reported entities |
| GET | /api/v1/feed | Get live feed of reports |
| POST | /api/v1/feed/{id}/react | React to a report |
| POST | /api/v1/feed/{id}/comment | Comment on a report |
| GET | /api/v1/dashboard/stats | Get platform statistics |
| GET | /api/v1/dashboard/top-flagged | Get top flagged entities |
| POST | /api/v1/dispute | Submit a dispute |
| GET | /api/v1/health | Health check |

Full interactive docs at: https://your-backend-url.onrender.com/docs
