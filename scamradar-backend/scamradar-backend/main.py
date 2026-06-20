from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import reports, search, feed, dashboard, dispute
from core.database import connect_db, close_db

app = FastAPI(
    title="ScamRadar API",
    description="Community-powered scam detection platform API",
    version="1.0.0"
)

# ── CORS — allow your Netlify frontend + local testing ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://magnificent-bonbon-fd2631.netlify.app",
        "http://localhost:3000",
        "http://127.0.0.1:5500",
        "*"  # Remove this in production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Database lifecycle ──
@app.on_event("startup")
async def startup():
    await connect_db()

@app.on_event("shutdown")
async def shutdown():
    await close_db()

# ── Routers ──
app.include_router(reports.router,   prefix="/api/v1", tags=["Reports"])
app.include_router(search.router,    prefix="/api/v1", tags=["Search"])
app.include_router(feed.router,      prefix="/api/v1", tags=["Feed"])
app.include_router(dashboard.router, prefix="/api/v1", tags=["Dashboard"])
app.include_router(dispute.router,   prefix="/api/v1", tags=["Dispute"])

@app.get("/")
async def root():
    return {
        "message": "ScamRadar API is live 🛡️",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}
