import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import Optional

from backend.database import supabase
from backend.models import SearchRequest, StatusUpdate, NotesUpdate
from backend.places import search_places

app = FastAPI(title="LeadHunter")

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/")
def index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/leads")
def get_leads(
    city: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    query = supabase.table("leads").select("*").order("created_at", desc=True)
    if city:
        query = query.eq("city", city)
    if category:
        query = query.eq("category", category)
    if status:
        query = query.eq("status", status)
    result = query.execute()
    return result.data


@app.post("/leads/search")
async def search_leads(request: SearchRequest):
    places = await search_places(request.query, request.city)

    # Pobierz istniejące nazwy firm dla tego miasta
    existing = supabase.table("leads").select("name").eq("city", request.city).execute()
    existing_names = {row["name"].lower() for row in existing.data}

    saved = []
    for place in places:
        if place["name"].lower() in existing_names:
            continue  # duplikat — pomijamy
        result = supabase.table("leads").insert(place).execute()
        if result.data:
            saved.append(result.data[0])
            existing_names.add(place["name"].lower())
    return saved


@app.patch("/leads/{lead_id}/status")
def update_status(lead_id: str, body: StatusUpdate):
    result = supabase.table("leads").update({"status": body.status}).eq("id", lead_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Lead nie znaleziony")
    return result.data[0]


@app.patch("/leads/{lead_id}/notes")
def update_notes(lead_id: str, body: NotesUpdate):
    result = supabase.table("leads").update({"notes": body.notes}).eq("id", lead_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Lead nie znaleziony")
    return result.data[0]


@app.delete("/leads/{lead_id}")
def delete_lead(lead_id: str):
    result = supabase.table("leads").delete().eq("id", lead_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Lead nie znaleziony")
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
