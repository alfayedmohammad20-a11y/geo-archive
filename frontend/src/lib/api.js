import axios from "axios";

export const API = "/api";

export const http = axios.create({
  baseURL: API,
  withCredentials: true,
});

export function fileUrl (mapId, kind = "download") {
  return '/api/maps/${mapId}/${kind}';
}
