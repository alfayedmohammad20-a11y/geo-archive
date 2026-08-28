"""Security posture checks: bcrypt hash format, seed_admin idempotency/update, CORS at app level."""
import asyncio
import os

import pytest
import requests
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND_ENV = dotenv_values("/app/backend/.env")
INTERNAL_URL = "http://localhost:8001"


def _db():
    url = BACKEND_ENV.get("MONGO_URL") or os.environ["MONGO_URL"]
    name = BACKEND_ENV.get("DB_NAME") or os.environ["DB_NAME"]
    client = AsyncIOMotorClient(url)
    return client, client[name]


class TestSecurityPosture:
    def test_admin_password_hash_is_bcrypt_2b(self, test_credentials):
        async def run():
            client, db = _db()
            try:
                return await db.users.find_one({"email": test_credentials["email"].lower()})
            finally:
                client.close()

        user = asyncio.run(run())
        assert user is not None, "Admin user not seeded in DB"
        h = user["password_hash"]
        assert h.startswith("$2b$"), f"bcrypt hash prefix not $2b$: {h[:7]}"
        assert user["role"] == "admin"

    def test_seed_admin_is_idempotent_single_user(self, test_credentials):
        async def run():
            client, db = _db()
            try:
                return await db.users.count_documents({"email": test_credentials["email"].lower()})
            finally:
                client.close()

        assert asyncio.run(run()) == 1, "Duplicate admin users created by seeding"

    def test_env_password_has_no_shell_expansion_chars(self):
        pwd = BACKEND_ENV.get("ADMIN_PASSWORD")
        assert pwd, "ADMIN_PASSWORD missing from backend/.env"
        assert "$" not in pwd, "ADMIN_PASSWORD contains '$' (shell/dotenv expansion risk)"

    def test_cors_preflight_at_app_level(self):
        # Ingress/CDN answers OPTIONS on the public URL, so app-level CORS is asserted internally.
        origin = "https://geo-archive-3.preview.emergentagent.com"
        r = requests.options(
            f"{INTERNAL_URL}/api/auth/login",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
            timeout=30,
        )
        assert r.status_code in (200, 204), r.text[:300]
        assert r.headers.get("access-control-allow-credentials") == "true"
        assert r.headers.get("access-control-allow-origin") == origin, (
            "CORS must echo an explicit origin (not '*') when credentials are allowed; "
            f"got {r.headers.get('access-control-allow-origin')}"
        )

    def test_jwt_secret_configured(self):
        assert BACKEND_ENV.get("JWT_SECRET"), "JWT_SECRET missing"
        assert len(BACKEND_ENV["JWT_SECRET"]) >= 32

    @pytest.mark.xfail(reason="No brute-force protection implemented in /api/auth/login", strict=False)
    def test_brute_force_lockout_internal(self, test_credentials):
        statuses = []
        for _ in range(6):
            r = requests.post(
                f"{INTERNAL_URL}/api/auth/login",
                json={"email": test_credentials["email"], "password": "wrong-pass-abc"},
                timeout=30,
            )
            statuses.append(r.status_code)
        assert 429 in statuses or 423 in statuses, f"no lockout, statuses={statuses}"
