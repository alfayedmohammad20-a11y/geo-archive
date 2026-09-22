import axios from "axios";

export const API = "https://geo-archive-3.emergent.host/api";

export const http = axios.create({
  baseURL: API,
  withCredentials: true,
});

export function fileUrl (mapId, kind = "download") {
  return '${API}/maps/${mapId}/${kind}';
}
