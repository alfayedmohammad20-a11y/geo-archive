# Geo Archive — PRD

## Problem Statement
Public web application for archiving, managing, and viewing geospatial mapping files (SHP, KML, KMZ). Public browsing, admin-only uploads, Google Earth Pro integration, and a Leaflet-powered web preview.

## User Personas
- Public visitor: search/browse/preview/download maps.
- Admin curator: sign in, upload, edit, delete archive entries.

## Core Requirements
- Upload/store/download SHP (zipped), KML, KMZ files.
- Search by name/description on public archive.
- One-click "Open in Google Earth Pro" (KML export/conversion).
- In-browser Leaflet preview with OpenStreetMap base.
- Admin-only upload/delete with JWT auth.

## What's Implemented (Feb 2026)
- Backend (FastAPI): JWT auth (httpOnly cookie + Bearer), admin seed, Emergent Object Storage upload/download, SHP→GeoJSON/KML, KML/KMZ→GeoJSON conversion, /health endpoint.
- Frontend (React + Tailwind): Home archive with search, Map detail with Leaflet preview + KML download, Admin login + dashboard, Phosphor icons, Swiss/high-contrast theme.
- Design: Cabinet Grotesk + IBM Plex Sans, sharp edges, IKB primary #002FA7, topo texture hero.

## Backlog / Next
- P1: Bulk upload of multiple shapefiles
- P1: Live KML NetworkLink endpoint per map
- P2: Categories/tags/regions
- P2: Public user comments/rating
- P2: PostGIS backend for spatial queries
