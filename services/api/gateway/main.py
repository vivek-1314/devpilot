from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI

from gateway.routes.code_intelligence import router as code_intelligence_router

app = FastAPI(title="DevPilot API")


@app.get("/health")
def health():
    return {"ok": True}


app.include_router(code_intelligence_router)
