import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
_base = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not _base:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = _base.rstrip("/")

MINIMAL_KML = b"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>TEST_Doc</name>
    <Placemark>
      <name>TEST Point</name>
      <description>a test placemark</description>
      <Point><coordinates>77.5946,12.9716,0</coordinates></Point>
    </Placemark>
    <Placemark>
      <name>TEST Line</name>
      <LineString><coordinates>77.0,12.0,0 78.0,13.0,0</coordinates></LineString>
    </Placemark>
  </Document>
</kml>
"""


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="class")
def api_client():
    s = requests.Session()
    return s


@pytest.fixture(scope="session")
def test_credentials():
    p = Path("/app/memory/test_credentials.md")
    if not p.exists():
        pytest.skip("Missing /app/memory/test_credentials.md")
    content = p.read_text(encoding="utf-8")
    email = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?email(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    pwd = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?password(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    if not email or not pwd:
        pytest.skip("No credentials parsed")
    return {"email": email.group(1), "password": pwd.group(1)}


@pytest.fixture(scope="class")
def auth_token(test_credentials):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": test_credentials["email"], "password": test_credentials["password"]},
        timeout=60,
    )
    if r.status_code != 200:
        pytest.fail(f"Auth failed {r.status_code}: {r.text[:300]}")
    token = r.json().get("token")
    if not token:
        pytest.fail("No token in login response")
    return token


@pytest.fixture(scope="class")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def minimal_kml():
    return MINIMAL_KML
