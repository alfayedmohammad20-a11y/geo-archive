import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
export const API = `${BACKEND}/api` : "/api";

// All auth is handled via httpOnly cookies set by the backend on /auth/login.
// withCredentials ensures the browser attaches those cookies on every request.
export const http = axios.create({
  baseURL: API,
  withCredentials: true,
});

export function fileUrl(mapId, kind = "download") {
  // kind: 'download' | 'kml' | 'geojson'
  return `${API}/maps/${mapId}/${kind}`;
}
