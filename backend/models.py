from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class Lead(BaseModel):
    id: Optional[str] = None
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    reviews_count: Optional[int] = 0
    category: Optional[str] = None
    city: Optional[str] = None
    status: str = "Nowy"
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


class SearchRequest(BaseModel):
    query: str
    city: str


class StatusUpdate(BaseModel):
    status: str


class NotesUpdate(BaseModel):
    notes: str
