import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND}/api`;

export const http = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Attach Bearer token from localStorage if present (fallback for cookie-less contexts)
http.interceptors.request.use((config) => {
  const t = localStorage.getItem("token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export function fileUrl(mapId, kind = "download") {
  // kind: 'download' | 'kml' | 'geojson'
  return `${API}/maps/${mapId}/${kind}`;
}
