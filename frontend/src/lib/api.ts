import axios from "axios";
import { io } from "socket.io-client";

export const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:3002/api/v1";
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3002";

export const api = axios.create({ baseURL: BACKEND_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = token;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      if (window.location.pathname !== "/signin") window.location.href = "/signin";
    }
    return Promise.reject(err);
  }
);

// A single shared socket connection for the whole app — pages join/leave
// showtime-specific rooms as needed rather than opening new connections.
export const socket = io(SOCKET_URL, { autoConnect: false });

export function friendlyError(err: any): string {
  const raw: string | undefined = err?.response?.data?.message;
  if (err?.code === "ERR_NETWORK") return "Can't reach the server. Is it running?";
  if (err?.response?.status === 429) return raw ?? "Too many attempts. Try again in a few minutes.";
  return raw ?? "Something went wrong. Please try again.";
}
