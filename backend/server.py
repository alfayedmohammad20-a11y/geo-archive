from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import io
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from bson import ObjectId
from fastapi import (
    APIRouter,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

from gis_utils import file_to_geojson, file_to_kml_bytes
from storage import APP_NAME, get_object, init_storage, put_object

# ------------------ Setup ------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Geo Archive")
api = APIRouter(prefix="/api")

JWT_ALG = "HS256"
ALLOWED_EXT = {"kml", "kmz", "zip"}
MIME = {
    "kml": "application/vnd.google-earth.kml+xml",
    "kmz": "application/vnd.google-earth.kmz",
    "zip": "application/zip",
}


def jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def create_token(user_id: str, email: str, minutes: int = 60 * 24 * 7) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes),
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALG)


async def get_current_admin(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    user["_id"] = str(user["_id"])
    user.pop("password_hash", None)
    return user


# ------------------ Models ------------------

class LoginIn(BaseModel):
    email: str
    password: str


class MapOut(BaseModel):
    id: str
    name: str
    description: str
    ext: str
    size: int
    original_filename: str
    created_at: str


# ------------------ Auth ------------------

@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(str(user["_id"]), email)
    response.set_cookie(
        "access_token",
        token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
        path="/",
    )
    return {
        "id": str(user["_id"]),
        "email": email,
        "role": user.get("role", "admin"),
    }


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_admin)):
    return {"id": user["_id"], "email": user["email"], "role": user.get("role")}


# ------------------ Maps ------------------

def _map_doc_out(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "name": doc["name"],
        "description": doc.get("description", ""),
        "ext": doc["ext"],
        "size": doc.get("size", 0),
        "original_filename": doc.get("original_filename", ""),
        "created_at": doc.get("created_at", ""),
        "tags": doc.get("tags", []),
    }


def _parse_tags(raw: str) -> list[str]:
    if not raw:
        return []
    seen: list[str] = []
    for part in raw.split(","):
        t = part.strip().lower()
        if t and t not in seen and len(t) <= 40:
            seen.append(t)
    return seen[:12]


@api.get("/maps")
async def list_maps(q: Optional[str] = None, tags: Optional[str] = None):
    query: dict = {"is_deleted": {"$ne": True}}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}},
        ]
    tag_list = _parse_tags(tags or "")
    if tag_list:
        query["tags"] = {"$in": tag_list}
    docs = await db.maps.find(query).sort("created_at", -1).to_list(500)
    return [_map_doc_out(d) for d in docs]


@api.get("/tags")
async def list_tags():
    """Return all distinct tags across live maps, sorted alphabetically."""
    tags = await db.maps.distinct("tags", {"is_deleted": {"$ne": True}})
    return sorted([t for t in tags if isinstance(t, str) and t])


@api.get("/maps/{map_id}")
async def get_map(map_id: str):
    doc = await db.maps.find_one({"id": map_id, "is_deleted": {"$ne": True}})
    if not doc:
        raise HTTPException(status_code=404, detail="Map not found")
    return _map_doc_out(doc)


@api.post("/maps")
async def create_map(
    name: str = Form(...),
    description: str = Form(""),
    tags: str = Form(""),
    file: UploadFile = File(...),
    _: dict = Depends(get_current_admin),
):
    filename = file.filename or "upload"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail="Only .kml, .kmz, or .zip (Shapefile) files are allowed",
        )
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    map_id = str(uuid.uuid4())
    storage_path = f"{APP_NAME}/maps/{map_id}.{ext}"
    result = put_object(storage_path, data, MIME.get(ext, "application/octet-stream"))

    doc = {
        "id": map_id,
        "name": name.strip(),
        "description": description.strip(),
        "ext": ext,
        "size": result.get("size", len(data)),
        "storage_path": result["path"],
        "original_filename": filename,
        "tags": _parse_tags(tags),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.maps.insert_one(doc)
    return _map_doc_out(doc)


@api.delete("/maps/{map_id}")
async def delete_map(map_id: str, _: dict = Depends(get_current_admin)):
    res = await db.maps.update_one(
        {"id": map_id}, {"$set": {"is_deleted": True}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Map not found")
    return {"ok": True}


def _load_file(doc: dict) -> bytes:
    data, _ = get_object(doc["storage_path"])
    return data


@api.get("/maps/{map_id}/download")
async def download_map(map_id: str):
    doc = await db.maps.find_one({"id": map_id, "is_deleted": {"$ne": True}})
    if not doc:
        raise HTTPException(status_code=404, detail="Map not found")
    data = _load_file(doc)
    filename = doc.get("original_filename") or f"{doc['name']}.{doc['ext']}"
    return StreamingResponse(
        io.BytesIO(data),
        media_type=MIME.get(doc["ext"], "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api.get("/maps/{map_id}/kml")
async def download_as_kml(map_id: str):
    doc = await db.maps.find_one({"id": map_id, "is_deleted": {"$ne": True}})
    if not doc:
        raise HTTPException(status_code=404, detail="Map not found")
    data = _load_file(doc)
    kml: bytes = b""
    try:
        kml = file_to_kml_bytes(data, doc["ext"], name=doc["name"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conversion failed: {e}")
    safe_name = "".join(c for c in doc["name"] if c.isalnum() or c in ("-", "_"))[:60] or "map"
    return StreamingResponse(
        io.BytesIO(kml),
        media_type=MIME["kml"],
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}.kml"'
        },
    )


@api.get("/maps/{map_id}/geojson")
async def as_geojson(map_id: str):
    doc = await db.maps.find_one({"id": map_id, "is_deleted": {"$ne": True}})
    if not doc:
        raise HTTPException(status_code=404, detail="Map not found")
    data = _load_file(doc)
    gj: dict = {}
    try:
        gj = file_to_geojson(data, doc["ext"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parse failed: {e}")
    return gj


@api.get("/")
async def root():
    return {"service": "geo-archive", "status": "ok"}


# ------------------ App wiring ------------------

app.include_router(api)


@app.get("/health")
@app.get("/healthz")
@app.get("/api/health")
async def health():
    return {"status": "ok"}

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "alfayedmohammad20@gmail.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    
    existing = await db.users.find_one({"email": admin_email})
    new_hash = hash_password(admin_password)
    
    if existing is None:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": new_hash,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded admin user: %s", admin_email)
    else:
        # Selalu perbarui hash password agar sesuai dengan admin_password terbaru
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": new_hash}}
        )
        logger.info("Updated admin password for: %s", admin_email)
            {"$set": {"password_hash": hash_password(admin_password)}},
        )
    await db.users.create_index("email", unique=True)
    await db.maps.create_index("id", unique=True)
    # Storage
    try:
        init_storage()
    except Exception as e:
        logger.error("Storage init failed: %s", e)


@app.on_event("shutdown")
async def shutdown():
    client.close()
