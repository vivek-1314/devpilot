from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI

from services.api.routes.code_intelligence_route import router as code_intelligence_router
from services.api.routes.quality_route import router as quality_router
from services.api.routes.repos_route import router as repos_route_router
from services.api.routes.webhooks_route import router as webhooks_router


app = FastAPI(title="DevPilot API")


@app.get("/health")
def health():
    return {"ok": True}


app.include_router(code_intelligence_router)
app.include_router(quality_router)
app.include_router(repos_route_router)
app.include_router(webhooks_router)
