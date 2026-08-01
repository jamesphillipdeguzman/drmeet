const getEnvApiOrigin = () => {
  if (typeof process !== "undefined" && process?.env) {
    if (process.env.VITE_API_URL) return process.env.VITE_API_URL;
    if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  }
  if (typeof window !== "undefined" && window.__ENV__) {
    if (window.__ENV__.VITE_API_URL) return window.__ENV__.VITE_API_URL;
    if (window.__ENV__.API_URL) return window.__ENV__.API_URL;
  }
  return null;
};

const isLocalHost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

const envOrigin = getEnvApiOrigin();

export const API_ORIGIN = envOrigin
  ? envOrigin.replace(/\/api\/?$/, "")
  : isLocalHost
  ? "http://localhost:3001"
  : "https://drmeet-wqws.onrender.com";

export const API_BASE = `${API_ORIGIN}/api`;
export const DASHBOARD_STATE_KEY = "drmeet-dashboard-state";
export const USER_CACHE_KEY = "drmeet-user-cache";
export const THEME_KEY = "drmeet-theme";
export const CLEAR_SEND_DOC_DOCTOR_KEY = "drmeet-clear-send-doc-doctor";
export const DOCTOR_OVERVIEW_CACHE_KEY = "drmeet-doctor-overview";
export const DOCTOR_OVERVIEW_TTL_MS = 45000;
export const DASH_TAG_HOME = "home";
export const DASH_TAG_FLOAT = "float";
export const MESSAGES_API = `${API_BASE}/messages`;
export const DEFAULT_AVATAR_URL = "/images/user-line.svg";
export const CHAT_UPLOAD_ICON_SRC = "/images/chat-upload-line.svg";
export const CHAT_SEND_ICON_SRC = "/images/send-plane-2-line.svg";
