"""Utilities for parsing SHP zips, KML, KMZ files to GeoJSON and KML."""
import io
import os
import tempfile
import zipfile
from typing import Any

import shapefile  # pyshp
import simplekml
from xml.etree import ElementTree as ET


KML_NS = {"kml": "http://www.opengis.net/kml/2.2"}


# ------------------ Shapefile ------------------

def shp_zip_to_geojson(zip_bytes: bytes) -> dict:
    """Extract a zipped shapefile and return a GeoJSON FeatureCollection."""
    with tempfile.TemporaryDirectory() as tmp:
        z = zipfile.ZipFile(io.BytesIO(zip_bytes))
        z.extractall(tmp)
        shp_file = None
        for root, _, files in os.walk(tmp):
            for f in files:
                if f.lower().endswith(".shp"):
                    shp_file = os.path.join(root, f)
                    break
            if shp_file:
                break
        if not shp_file:
            raise ValueError("No .shp file found in the archive")

        reader = shapefile.Reader(shp_file)
        fields = [f[0] for f in reader.fields[1:]]
        features = []
        for sr in reader.shapeRecords():
            geo = sr.shape.__geo_interface__
            props = dict(zip(fields, sr.record))
            # Ensure props are JSON-serializable
            props = {k: (v.isoformat() if hasattr(v, "isoformat") else v) for k, v in props.items()}
            features.append({"type": "Feature", "geometry": geo, "properties": props})
        return {"type": "FeatureCollection", "features": features}


def geojson_to_kml_bytes(geojson: dict, name: str = "Layer") -> bytes:
    """Convert a GeoJSON FeatureCollection to KML bytes."""
    kml = simplekml.Kml()
    folder = kml.newfolder(name=name)
    for feat in geojson.get("features", []):
        geom = feat.get("geometry") or {}
        gtype = geom.get("type")
        coords = geom.get("coordinates")
        props = feat.get("properties") or {}
        pname = str(props.get("name") or props.get("NAME") or "")
        desc = "<br/>".join(f"<b>{k}</b>: {v}" for k, v in props.items())
        if gtype == "Point":
            p = folder.newpoint(name=pname, coords=[tuple(coords[:2])])
            p.description = desc
        elif gtype == "LineString":
            ls = folder.newlinestring(name=pname, coords=[tuple(c[:2]) for c in coords])
            ls.description = desc
        elif gtype == "Polygon":
            outer = [tuple(c[:2]) for c in coords[0]]
            poly = folder.newpolygon(name=pname, outerboundaryis=outer)
            poly.description = desc
        elif gtype == "MultiPoint":
            for c in coords:
                folder.newpoint(name=pname, coords=[tuple(c[:2])])
        elif gtype == "MultiLineString":
            for line in coords:
                folder.newlinestring(name=pname, coords=[tuple(c[:2]) for c in line])
        elif gtype == "MultiPolygon":
            for poly_coords in coords:
                outer = [tuple(c[:2]) for c in poly_coords[0]]
                folder.newpolygon(name=pname, outerboundaryis=outer)
    return kml.kml().encode("utf-8")


# ------------------ KML / KMZ ------------------

def kmz_to_kml_bytes(kmz_bytes: bytes) -> bytes:
    """Extract the primary KML from a KMZ archive."""
    z = zipfile.ZipFile(io.BytesIO(kmz_bytes))
    for n in z.namelist():
        if n.lower().endswith(".kml"):
            return z.read(n)
    raise ValueError("No .kml file inside KMZ")


def _parse_kml_coords(text: str) -> list:
    coords = []
    for tok in text.strip().split():
        parts = tok.split(",")
        if len(parts) >= 2:
            try:
                coords.append([float(parts[0]), float(parts[1])])
            except ValueError:
                continue
    return coords


def kml_to_geojson(kml_bytes: bytes) -> dict:
    """Parse KML XML to a GeoJSON FeatureCollection (Point/LineString/Polygon)."""
    text = kml_bytes.decode("utf-8", errors="ignore")
    # Strip default namespace for simpler parsing
    text = text.replace('xmlns="http://www.opengis.net/kml/2.2"', "")
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return {"type": "FeatureCollection", "features": []}

    features = []
    for pm in root.iter("Placemark"):
        name_el = pm.find("name")
        desc_el = pm.find("description")
        props: dict[str, Any] = {}
        if name_el is not None and name_el.text:
            props["name"] = name_el.text.strip()
        if desc_el is not None and desc_el.text:
            props["description"] = desc_el.text.strip()

        geom = None
        pt = pm.find(".//Point/coordinates")
        if pt is not None and pt.text:
            c = _parse_kml_coords(pt.text)
            if c:
                geom = {"type": "Point", "coordinates": c[0]}

        if geom is None:
            ls = pm.find(".//LineString/coordinates")
            if ls is not None and ls.text:
                c = _parse_kml_coords(ls.text)
                if c:
                    geom = {"type": "LineString", "coordinates": c}

        if geom is None:
            poly = pm.find(".//Polygon//outerBoundaryIs//coordinates")
            if poly is not None and poly.text:
                c = _parse_kml_coords(poly.text)
                if c:
                    geom = {"type": "Polygon", "coordinates": [c]}

        if geom is not None:
            features.append({"type": "Feature", "geometry": geom, "properties": props})

    return {"type": "FeatureCollection", "features": features}


# ------------------ Dispatcher ------------------

def file_to_geojson(file_bytes: bytes, ext: str) -> dict:
    ext = ext.lower().lstrip(".")
    if ext == "zip":
        return shp_zip_to_geojson(file_bytes)
    if ext == "kml":
        return kml_to_geojson(file_bytes)
    if ext == "kmz":
        return kml_to_geojson(kmz_to_kml_bytes(file_bytes))
    raise ValueError(f"Unsupported extension: {ext}")


def file_to_kml_bytes(file_bytes: bytes, ext: str, name: str = "Layer") -> bytes:
    ext = ext.lower().lstrip(".")
    if ext == "kml":
        return file_bytes
    if ext == "kmz":
        return kmz_to_kml_bytes(file_bytes)
    if ext == "zip":
        return geojson_to_kml_bytes(shp_zip_to_geojson(file_bytes), name=name)
    raise ValueError(f"Unsupported extension: {ext}")
