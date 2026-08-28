"""Health probe endpoints: /health, /healthz (internal probes), /api/health, /api/ root."""
import requests

from conftest import BASE_URL

INTERNAL_URL = "http://localhost:8001"


class TestHealth:
    # /health and /healthz are not exposed through the ingress (only /api/* is proxied to the
    # backend), so they are validated against the internal service port used by k8s probes.
    def test_health_root_probe_internal(self):
        r = requests.get(f"{INTERNAL_URL}/health", timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json() == {"status": "ok"}

    def test_healthz_probe_internal(self):
        r = requests.get(f"{INTERNAL_URL}/healthz", timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json() == {"status": "ok"}

    def test_api_health_probe_public(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert r.json() == {"status": "ok"}

    def test_api_root(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=60)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["service"] == "geo-archive"
        assert data["status"] == "ok"
