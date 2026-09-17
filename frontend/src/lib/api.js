import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "https://geo-archive-3.emergent.host";
export const API = `${BACKEND}/api`;

export const http = axios.create({
  baseURL: API,
  withCredentials: false,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = 'Bearer ${token}';
  }
  return config;
});

export function fileUrl(mapId, kind = "download") {
  return `${API}/maps/${mapId}/${kind}`;
}
