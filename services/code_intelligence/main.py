from fastapi import FastAPI
from services.code_intelligence.router import router

app = FastAPI(title="code-intelligence")
app.include_router(router)


@app.get("/health")
def health():
    return {"ok": True}