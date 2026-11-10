from fastapi import FastAPI
from services.quality.router import router

app = FastAPI(title="quality")
app.include_router(router)


@app.get("/health")
def health():
    return {"ok": True}