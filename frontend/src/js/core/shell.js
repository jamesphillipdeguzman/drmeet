/**
 * frontend/src/js/core/shell.js
 * Application Bootstrap & Shell/Theme Interactions
 */

import { THEME_KEY, USER_CACHE_KEY } from "../config/api.js";
import { clearSessionExpiredState } from "./auth.js";
import { resetMessagingSocket } from "../modules/messaging.js";

// DOM References
const getSidebarToggle = () => document.getElementById("sidebar-toggle");
const getSidebar = () => document.getElementById("app-sidebar");
const getSidebarUserTrigger = () => document.getElementById("sidebar-user-trigger");
const getSidebarUserPopover = () => document.getElementById("sidebar-user-popover");
const getSidebarLogoutBtn = () => document.getElementById("sidebar-logout-btn");

// Global environmental callbacks
let updateAuthNav = null;
let renderLogin = null;

export function initShell(config = {}) {
  updateAuthNav = config.updateAuthNav || null;
  renderLogin = config.renderLogin || null;
}

export function applyTheme(theme) {
  const resolved = theme === "dark" ? "dark" : "light";
  document.body.classList.toggle("theme-dark", resolved === "dark");
  localStorage.setItem(THEME_KEY, resolved);
  window.dispatchEvent(new CustomEvent("themechanged", { detail: { theme: resolved } }));
}

export function bootstrapTheme() {
  const stored = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(stored);
}

export function setupShellInteractions() {
  const sidebarToggle = getSidebarToggle();
  const sidebar = getSidebar();
  const sidebarUserTrigger = getSidebarUserTrigger();
  const sidebarUserPopover = getSidebarUserPopover();
  const sidebarLogoutBtn = getSidebarLogoutBtn();

  if (!sidebarToggle || !sidebar) return;
  sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });
  sidebarUserTrigger?.addEventListener("click", (e) => {
    e.preventDefault();
    sidebarUserPopover?.classList.toggle("hidden");
  });
  sidebarLogoutBtn?.addEventListener("click", () => {
    if (window.__drmeetMessagePoll) {
      clearInterval(window.__drmeetMessagePoll);
      window.__drmeetMessagePoll = null;
    }
    localStorage.removeItem("token");
    localStorage.removeItem(USER_CACHE_KEY);
    clearSessionExpiredState();
    resetMessagingSocket();
    if (updateAuthNav) updateAuthNav();
    if (sidebarUserPopover) sidebarUserPopover.classList.add("hidden");
    window.location.hash = "#login";
    if (renderLogin) renderLogin();
  });
}
