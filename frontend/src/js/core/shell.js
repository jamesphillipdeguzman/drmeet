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
  document.documentElement.classList.toggle("dark", resolved === "dark");
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

  if (!sidebar) return;

  // Mobile Drawer Backdrop Setup
  let backdrop = document.getElementById("sidebar-mobile-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "sidebar-mobile-backdrop";
    backdrop.className = "sidebar-backdrop";
    document.body.appendChild(backdrop);
  }

  const openMobileSidebar = () => {
    sidebar.classList.add("mobile-open");
    backdrop.classList.add("active");
    document.body.style.overflow = "hidden";
  };

  const closeMobileSidebar = () => {
    sidebar.classList.remove("mobile-open");
    backdrop.classList.remove("active");
    document.body.style.overflow = "";
  };

  const toggleSidebarState = () => {
    if (window.innerWidth <= 768) {
      if (sidebar.classList.contains("mobile-open")) {
        closeMobileSidebar();
      } else {
        openMobileSidebar();
      }
    } else {
      sidebar.classList.toggle("collapsed");
    }
  };

  backdrop.addEventListener("click", closeMobileSidebar);

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSidebarState();
    });
  }

  document.querySelectorAll("#mobile-menu-toggle, .mobile-hamburger-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSidebarState();
    });
  });

  // Task 2: Avatar & Profile Picture click expands collapsed sidebar
  const avatarCircle = document.querySelector(".sidebar-avatar-circle");
  if (avatarCircle) {
    avatarCircle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (sidebar.classList.contains("collapsed")) {
        sidebar.classList.remove("collapsed");
      } else {
        sidebarUserPopover?.classList.toggle("hidden");
      }
    });
  }

  sidebarUserTrigger?.addEventListener("click", (e) => {
    e.preventDefault();
    if (sidebar.classList.contains("collapsed")) {
      sidebar.classList.remove("collapsed");
    } else {
      sidebarUserPopover?.classList.toggle("hidden");
    }
  });

  // Task 3: Touch Swipe Gestures for Mobile Sidebar Drawer
  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  document.addEventListener("touchend", (e) => {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      if (deltaX > 0 && touchStartX < 40 && !sidebar.classList.contains("mobile-open")) {
        // Swipe Right from left edge -> Open Drawer
        openMobileSidebar();
      } else if (deltaX < 0 && sidebar.classList.contains("mobile-open")) {
        // Swipe Left when open -> Close Drawer
        closeMobileSidebar();
      }
    }
  }, { passive: true });

  document.querySelectorAll("#app-sidebar .nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 768) {
        closeMobileSidebar();
      }
    });
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
    closeMobileSidebar();
    window.location.hash = "#login";
    if (renderLogin) renderLogin();
  });
}
