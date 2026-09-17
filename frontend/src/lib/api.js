import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "https://geo-archive-3.emergent.host";
export const API = `${BACKEND}/api`;

export const http = axios.create({
  baseURL: API,
  withCredentials: false,
});

export function fileUrl(mapId, kind = "download") {
  return `${API}/maps/${mapId}/${kind}`;
}
