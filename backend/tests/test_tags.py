"""Category tags feature: upload with tags, tag filtering (OR), /api/tags, normalization, search by tag."""
import pytest
import requests

from conftest import BASE_URL


def _upload(headers, name, tags, content, description="TEST tags description"):
    return requests.post(
        f"{BASE_URL}/api/maps",
        headers=headers,
        data={"name": name, "description": description, "tags": tags},
        files={"file": ("tags_test.kml", content, "application/vnd.google-earth.kml+xml")},
        timeout=180,
    )


@pytest.fixture(scope="class")
def created_ids():
    return []


@pytest.fixture(scope="class", autouse=True)
def cleanup(created_ids, auth_headers):
    yield
    for mid in created_ids:
        requests.delete(f"{BASE_URL}/api/maps/{mid}", headers=auth_headers, timeout=60)


class TestTags:
    def test_01_upload_with_tags(self, auth_headers, created_ids, minimal_kml):
        r = _upload(auth_headers, "TEST_Tags_Map", "europe, hydrology", minimal_kml)
        assert r.status_code == 200, r.text[:500]
        d = r.json()
        assert d["tags"] == ["europe", "hydrology"], d
        created_ids.append(d["id"])

    def test_02_list_includes_tags(self, created_ids):
        r = requests.get(f"{BASE_URL}/api/maps", timeout=60)
        assert r.status_code == 200
        doc = next((x for x in r.json() if x["id"] == created_ids[0]), None)
        assert doc is not None, "uploaded map missing from list"
        assert doc["tags"] == ["europe", "hydrology"]

    def test_03_filter_single_tag(self, created_ids):
        r = requests.get(f"{BASE_URL}/api/maps", params={"tags": "europe"}, timeout=60)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert created_ids[0] in [x["id"] for x in data]
        for x in data:
            assert "europe" in x["tags"], x

    def test_04_filter_nonexistent_tag_empty(self):
        r = requests.get(f"{BASE_URL}/api/maps", params={"tags": "nonexistent-tag"}, timeout=60)
        assert r.status_code == 200
        assert r.json() == []

    def test_05_filter_multi_tag_or(self, auth_headers, created_ids, minimal_kml):
        r2 = _upload(auth_headers, "TEST_Tags_Map2", "asia", minimal_kml)
        assert r2.status_code == 200, r2.text[:300]
        second = r2.json()
        created_ids.append(second["id"])
        assert second["tags"] == ["asia"]

        r = requests.get(f"{BASE_URL}/api/maps", params={"tags": "europe,asia"}, timeout=60)
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()]
        assert created_ids[0] in ids and second["id"] in ids, "OR filtering across tags failed"

    def test_06_tags_endpoint_sorted_distinct(self, created_ids):
        r = requests.get(f"{BASE_URL}/api/tags", timeout=60)
        assert r.status_code == 200, r.text[:300]
        tags = r.json()
        assert isinstance(tags, list)
        assert tags == sorted(tags), f"not sorted: {tags}"
        assert len(tags) == len(set(tags)), "duplicate tags returned"
        for t in ("europe", "hydrology", "asia"):
            assert t in tags, f"{t} missing from /api/tags: {tags}"

    def test_07_search_matches_tag_values(self, created_ids):
        r = requests.get(f"{BASE_URL}/api/maps", params={"q": "hydrology"}, timeout=60)
        assert r.status_code == 200
        assert created_ids[0] in [x["id"] for x in r.json()], "search q did not match tag value"

    def test_08_tag_normalization_dedupe_and_case(self, auth_headers, created_ids, minimal_kml):
        r = _upload(auth_headers, "TEST_Tags_Norm", "Europe, EUROPE ,  europe ", minimal_kml)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        created_ids.append(d["id"])
        assert d["tags"] == ["europe"], d["tags"]

    def test_09_tag_limits_length_and_count(self, auth_headers, created_ids, minimal_kml):
        long_tag = "x" * 41
        many = ",".join(f"t{i}" for i in range(20))
        r = _upload(auth_headers, "TEST_Tags_Limits", f"{long_tag},{many}", minimal_kml)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        created_ids.append(d["id"])
        assert long_tag not in d["tags"], "tag >40 chars was stored"
        assert len(d["tags"]) <= 12, f"more than 12 tags stored: {d['tags']}"

    def test_10_empty_tags_returns_empty_list(self, auth_headers, created_ids, minimal_kml):
        r = _upload(auth_headers, "TEST_Tags_None", "", minimal_kml)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        created_ids.append(d["id"])
        assert d["tags"] == []

    def test_11_delete_removes_tag_from_tags_endpoint(self, auth_headers, minimal_kml):
        r = _upload(auth_headers, "TEST_Tags_Unique", "TEST-unique-tag-zz", minimal_kml)
        assert r.status_code == 200
        mid = r.json()["id"]
        assert "test-unique-tag-zz" in requests.get(f"{BASE_URL}/api/tags", timeout=60).json()

        d = requests.delete(f"{BASE_URL}/api/maps/{mid}", headers=auth_headers, timeout=60)
        assert d.status_code == 200
        tags = requests.get(f"{BASE_URL}/api/tags", timeout=60).json()
        assert "test-unique-tag-zz" not in tags, "deleted map's tag still listed in /api/tags"

    def test_12_detail_endpoint_returns_tags(self, created_ids):
        r = requests.get(f"{BASE_URL}/api/maps/{created_ids[0]}", timeout=60)
        assert r.status_code == 200
        assert r.json()["tags"] == ["europe", "hydrology"]

    def test_13_tags_filter_combined_with_q(self, created_ids):
        r = requests.get(
            f"{BASE_URL}/api/maps",
            params={"q": "TEST_Tags_Map", "tags": "europe"},
            timeout=60,
        )
        assert r.status_code == 200, r.text[:300]
        ids = [x["id"] for x in r.json()]
        assert created_ids[0] in ids, "combined q+tags filter dropped the matching map"
