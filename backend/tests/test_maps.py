"""Maps module: upload (auth), list, search, detail, download, kml export, geojson, delete."""
import io
import json
import zipfile

import pytest
import requests

from conftest import BASE_URL, MINIMAL_KML


def _upload(headers, name, filename, content, ctype, description="TEST description"):
    return requests.post(
        f"{BASE_URL}/api/maps",
        headers=headers,
        data={"name": name, "description": description},
        files={"file": (filename, content, ctype)},
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


class TestMapsPublicRead:
    def test_list_maps_public_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/maps", timeout=60)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data, list)
        for d in data:
            assert "id" in d and "name" in d and "ext" in d
            assert "_id" not in d, "MongoDB _id leaked in response"
            assert "storage_path" not in d, "storage_path leaked in response"

    def test_get_unknown_map_404(self):
        r = requests.get(f"{BASE_URL}/api/maps/does-not-exist-123", timeout=60)
        assert r.status_code == 404, r.text[:300]

    def test_download_unknown_map_404(self):
        r = requests.get(f"{BASE_URL}/api/maps/does-not-exist-123/download", timeout=60)
        assert r.status_code == 404, r.text[:300]

    def test_kml_unknown_map_404(self):
        r = requests.get(f"{BASE_URL}/api/maps/does-not-exist-123/kml", timeout=60)
        assert r.status_code == 404, r.text[:300]

    def test_geojson_unknown_map_404(self):
        r = requests.get(f"{BASE_URL}/api/maps/does-not-exist-123/geojson", timeout=60)
        assert r.status_code == 404, r.text[:300]


class TestMapsAuthGuards:
    def test_create_map_without_auth_401(self, minimal_kml):
        r = _upload({}, "TEST_NoAuth", "t.kml", minimal_kml, "application/vnd.google-earth.kml+xml")
        assert r.status_code == 401, f"expected 401 got {r.status_code}: {r.text[:300]}"

    def test_create_map_invalid_token_401(self, minimal_kml):
        r = _upload(
            {"Authorization": "Bearer bogus.token.value"},
            "TEST_BadToken",
            "t.kml",
            minimal_kml,
            "application/vnd.google-earth.kml+xml",
        )
        assert r.status_code == 401, r.text[:300]

    def test_delete_map_without_auth_401(self):
        r = requests.delete(f"{BASE_URL}/api/maps/some-id", timeout=60)
        assert r.status_code == 401, r.text[:300]

    def test_create_map_rejects_bad_extension(self, auth_headers):
        r = _upload(auth_headers, "TEST_BadExt", "notes.txt", b"hello", "text/plain")
        assert r.status_code == 400, r.text[:300]
        assert "allowed" in r.json()["detail"].lower()

    def test_create_map_rejects_empty_file(self, auth_headers):
        r = _upload(auth_headers, "TEST_Empty", "empty.kml", b"", "application/vnd.google-earth.kml+xml")
        assert r.status_code == 400, r.text[:300]
        assert "empty" in r.json()["detail"].lower()


class TestKmlLifecycle:
    """Full lifecycle for a KML upload."""

    def test_01_upload_kml(self, auth_headers, created_ids, minimal_kml):
        r = _upload(
            auth_headers,
            "TEST_KML_Map",
            "test_map.kml",
            minimal_kml,
            "application/vnd.google-earth.kml+xml",
        )
        assert r.status_code == 200, f"upload failed {r.status_code}: {r.text[:500]}"
        doc = r.json()
        assert isinstance(doc["id"], str) and len(doc["id"]) > 10
        assert doc["name"] == "TEST_KML_Map"
        assert doc["description"] == "TEST description"
        assert doc["ext"] == "kml"
        assert doc["size"] == len(minimal_kml)
        assert doc["original_filename"] == "test_map.kml"
        assert doc["created_at"]
        assert "_id" not in doc and "storage_path" not in doc
        created_ids.append(doc["id"])

    def test_02_new_map_in_list(self, created_ids):
        mid = created_ids[0]
        r = requests.get(f"{BASE_URL}/api/maps", timeout=60)
        assert r.status_code == 200
        ids = [d["id"] for d in r.json()]
        assert mid in ids, "Uploaded map missing from GET /api/maps"

    def test_03_search_filter(self, created_ids):
        r = requests.get(f"{BASE_URL}/api/maps", params={"q": "TEST_KML_Map"}, timeout=60)
        assert r.status_code == 200, r.text[:300]
        ids = [d["id"] for d in r.json()]
        assert created_ids[0] in ids, "Search by name did not return the map"

        r2 = requests.get(f"{BASE_URL}/api/maps", params={"q": "zzz_no_match_zzz"}, timeout=60)
        assert r2.status_code == 200
        assert created_ids[0] not in [d["id"] for d in r2.json()]

    def test_04_get_map_detail(self, created_ids):
        r = requests.get(f"{BASE_URL}/api/maps/{created_ids[0]}", timeout=60)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["id"] == created_ids[0]
        assert d["name"] == "TEST_KML_Map"
        assert d["ext"] == "kml"

    def test_05_download_original_bytes(self, created_ids, minimal_kml):
        r = requests.get(f"{BASE_URL}/api/maps/{created_ids[0]}/download", timeout=120)
        assert r.status_code == 200, r.text[:300]
        assert r.content == minimal_kml, "Downloaded bytes differ from uploaded bytes"
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd and "test_map.kml" in cd, f"bad content-disposition: {cd}"
        assert "kml" in r.headers.get("content-type", "")

    def test_06_kml_export_identity(self, created_ids, minimal_kml):
        r = requests.get(f"{BASE_URL}/api/maps/{created_ids[0]}/kml", timeout=120)
        assert r.status_code == 200, r.text[:500]
        assert r.content == minimal_kml
        cd = r.headers.get("content-disposition", "")
        assert "TEST_KML_Map.kml" in cd, f"bad content-disposition: {cd}"
        assert r.headers.get("content-type", "").startswith("application/vnd.google-earth.kml")

    def test_07_geojson_featurecollection(self, created_ids):
        r = requests.get(f"{BASE_URL}/api/maps/{created_ids[0]}/geojson", timeout=120)
        assert r.status_code == 200, r.text[:500]
        gj = r.json()
        assert gj["type"] == "FeatureCollection"
        assert isinstance(gj["features"], list)
        assert len(gj["features"]) == 2, f"expected 2 features, got {len(gj['features'])}"
        types = sorted(f["geometry"]["type"] for f in gj["features"])
        assert types == ["LineString", "Point"], types
        pt = [f for f in gj["features"] if f["geometry"]["type"] == "Point"][0]
        assert pt["geometry"]["coordinates"] == [77.5946, 12.9716]
        assert pt["properties"]["name"] == "TEST Point"

    def test_08_delete_soft_deletes(self, auth_headers, created_ids):
        mid = created_ids[0]
        r = requests.delete(f"{BASE_URL}/api/maps/{mid}", headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert r.json() == {"ok": True}

        assert requests.get(f"{BASE_URL}/api/maps/{mid}", timeout=60).status_code == 404
        assert mid not in [d["id"] for d in requests.get(f"{BASE_URL}/api/maps", timeout=60).json()]
        assert requests.get(f"{BASE_URL}/api/maps/{mid}/kml", timeout=60).status_code == 404
        assert requests.get(f"{BASE_URL}/api/maps/{mid}/geojson", timeout=60).status_code == 404
        assert requests.get(f"{BASE_URL}/api/maps/{mid}/download", timeout=60).status_code == 404

    def test_09_delete_unknown_map_404(self, auth_headers):
        r = requests.delete(f"{BASE_URL}/api/maps/no-such-map-id", headers=auth_headers, timeout=60)
        assert r.status_code == 404, r.text[:300]


class TestKmzAndShapefile:
    """KMZ and zipped-shapefile conversion paths."""

    def _kmz_bytes(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("doc.kml", MINIMAL_KML.decode())
        return buf.getvalue()

    def _shp_zip_bytes(self):
        import shapefile  # pyshp

        shp, shx, dbf = io.BytesIO(), io.BytesIO(), io.BytesIO()
        w = shapefile.Writer(shp=shp, shx=shx, dbf=dbf)
        w.field("NAME", "C")
        w.point(77.5946, 12.9716)
        w.record("TEST_PT")
        w.close()
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("layer.shp", shp.getvalue())
            z.writestr("layer.shx", shx.getvalue())
            z.writestr("layer.dbf", dbf.getvalue())
        return buf.getvalue()

    def test_kmz_upload_kml_and_geojson(self, auth_headers, created_ids):
        r = _upload(
            auth_headers,
            "TEST_KMZ_Map",
            "test.kmz",
            self._kmz_bytes(),
            "application/vnd.google-earth.kmz",
        )
        assert r.status_code == 200, f"kmz upload failed: {r.status_code} {r.text[:500]}"
        mid = r.json()["id"]
        created_ids.append(mid)
        assert r.json()["ext"] == "kmz"

        k = requests.get(f"{BASE_URL}/api/maps/{mid}/kml", timeout=120)
        assert k.status_code == 200, k.text[:500]
        assert b"<Placemark>" in k.content, "KMZ->KML conversion returned no placemarks"

        g = requests.get(f"{BASE_URL}/api/maps/{mid}/geojson", timeout=120)
        assert g.status_code == 200, g.text[:500]
        assert len(g.json()["features"]) == 2

    def test_shapefile_zip_upload_kml_and_geojson(self, auth_headers, created_ids):
        r = _upload(
            auth_headers,
            "TEST_SHP_Map",
            "test.zip",
            self._shp_zip_bytes(),
            "application/zip",
        )
        assert r.status_code == 200, f"zip upload failed: {r.status_code} {r.text[:500]}"
        mid = r.json()["id"]
        created_ids.append(mid)
        assert r.json()["ext"] == "zip"

        g = requests.get(f"{BASE_URL}/api/maps/{mid}/geojson", timeout=120)
        assert g.status_code == 200, g.text[:500]
        gj = g.json()
        assert gj["type"] == "FeatureCollection"
        assert len(gj["features"]) == 1
        assert gj["features"][0]["geometry"]["type"] == "Point"
        assert gj["features"][0]["properties"]["NAME"].strip() == "TEST_PT"

        k = requests.get(f"{BASE_URL}/api/maps/{mid}/kml", timeout=120)
        assert k.status_code == 200, k.text[:500]
        assert b"<Point" in k.content, "SHP->KML conversion produced no Point"
        assert b"TEST_PT" in k.content

    def test_corrupt_zip_returns_5xx_or_4xx_not_crash(self, auth_headers, created_ids):
        r = _upload(auth_headers, "TEST_Corrupt_Zip", "bad.zip", b"not-a-zip-at-all", "application/zip")
        assert r.status_code == 200, r.text[:300]
        mid = r.json()["id"]
        created_ids.append(mid)
        g = requests.get(f"{BASE_URL}/api/maps/{mid}/geojson", timeout=120)
        assert g.status_code == 500, f"expected handled 500, got {g.status_code}"
        assert "Parse failed" in json.dumps(g.json())
        k = requests.get(f"{BASE_URL}/api/maps/{mid}/kml", timeout=120)
        assert k.status_code == 500
        assert "Conversion failed" in json.dumps(k.json())
