"""Auth module: login (cookie + bearer), me, logout, negative cases, brute-force."""
import pytest
import requests

from conftest import BASE_URL


class TestAuth:
    def test_login_success_sets_cookie_and_token(self, api_client, test_credentials):
        r = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_credentials["email"], "password": test_credentials["password"]},
            timeout=60,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["email"] == test_credentials["email"].lower()
        assert data["role"] == "admin"
        assert "token" not in data, "Login body must NOT expose the JWT (httpOnly cookie only)"
        assert isinstance(data["id"], str) and len(data["id"]) > 0
        assert "password" not in data and "password_hash" not in data
        # httpOnly cookie assertions
        set_cookie = r.headers.get("set-cookie", "")
        assert "access_token=" in set_cookie, f"No access_token cookie: {set_cookie}"
        assert "httponly" in set_cookie.lower(), f"Cookie not HttpOnly: {set_cookie}"

    def test_login_case_insensitive_email(self, test_credentials):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_credentials["email"].upper(), "password": test_credentials["password"]},
            timeout=60,
        )
        assert r.status_code == 200, r.text[:300]
        assert r.json()["email"] == test_credentials["email"].lower()

    def test_login_wrong_password_401(self, test_credentials):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_credentials["email"], "password": "definitely-wrong-pass"},
            timeout=60,
        )
        assert r.status_code == 401, f"expected 401 got {r.status_code}: {r.text[:300]}"
        assert "detail" in r.json()

    def test_login_unknown_email_401(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "TEST_nobody@example.com", "password": "whatever"},
            timeout=60,
        )
        assert r.status_code == 401, r.text[:300]

    def test_login_missing_field_422(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "a@b.c"}, timeout=60)
        assert r.status_code == 422, r.text[:300]

    def test_me_with_bearer_token(self, auth_headers, test_credentials):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["email"] == test_credentials["email"].lower()
        assert data["role"] == "admin"
        assert "_id" not in data

    def test_me_with_cookie_session(self, test_credentials):
        s = requests.Session()
        s.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_credentials["email"], "password": test_credentials["password"]},
            timeout=60,
        )
        r = s.get(f"{BASE_URL}/api/auth/me", timeout=60)
        assert r.status_code == 200, f"cookie auth failed: {r.status_code} {r.text[:300]}"
        assert r.json()["role"] == "admin"

    def test_me_without_auth_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=60)
        assert r.status_code == 401, r.text[:300]

    def test_me_with_invalid_token_401(self):
        r = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer not.a.valid.jwt"},
            timeout=60,
        )
        assert r.status_code == 401, r.text[:300]

    def test_logout_clears_cookie(self, test_credentials):
        s = requests.Session()
        s.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_credentials["email"], "password": test_credentials["password"]},
            timeout=60,
        )
        r = s.post(f"{BASE_URL}/api/auth/logout", timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert r.json() == {"ok": True}
        assert not s.cookies.get("access_token")

    def test_cors_credentials_headers_public_edge(self, test_credentials):
        # NOTE: the public edge (Cloudflare/ingress) answers OPTIONS itself; app-level CORS is
        # asserted in test_security.py against the internal port.
        origin = BASE_URL
        r = requests.options(
            f"{BASE_URL}/api/auth/login",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
            timeout=60,
        )
        assert r.status_code in (200, 204), r.text[:300]
        assert r.headers.get("access-control-allow-origin") is not None

    @pytest.mark.xfail(reason="No brute-force/rate-limit protection on /api/auth/login", strict=False)
    def test_brute_force_lockout_after_5_failures(self, test_credentials):
        statuses = []
        for _ in range(6):
            r = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": test_credentials["email"], "password": "bad-password-xyz"},
                timeout=60,
            )
            statuses.append(r.status_code)
        assert 429 in statuses or 423 in statuses, (
            f"No brute-force lockout after 6 failed logins; statuses={statuses}"
        )
        # good password must still work after lockout window expectation
        ok = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_credentials["email"], "password": test_credentials["password"]},
            timeout=60,
        )
        assert ok.status_code in (200, 429)
