export function createNavigation({
  navLinks,
  commandPalette,
  commandInput,
  commandResults,
  commandPaletteTrigger,
  isLoggedIn,
  getCurrentUserRole,
  applyTheme,
  renderers,
}) {
  function getHashRoute() {
    const hash = window.location.hash || "#home";
    return hash.split("?")[0] || "#home";
  }

  function parseDoctorDashboardTab() {
    const raw = window.location.hash || "";
    const qIdx = raw.indexOf("?");
    const qs = qIdx >= 0 ? raw.slice(qIdx + 1) : "";
    const params = new URLSearchParams(qs);
    const tab = String(params.get("tab") || "overview").toLowerCase();
    const allowed = new Set([
      "overview",
      "patients",
      "appointments",
      "calendar",
      "documents",
      "settings",
      "billing",
    ]);
    return allowed.has(tab) ? tab : "overview";
  }

  function setDoctorDashboardHashTab(tab) {
    window.location.hash = `#doctor-dashboard?tab=${encodeURIComponent(tab)}`;
  }

  function getSignupRoleFromHash() {
    const hash = window.location.hash || "";
    const match = hash.match(/role=(doctor|patient|receptionist)/i);
    return match ? String(match[1]).toLowerCase() : "";
  }

  function setActiveNav(hash) {
    navLinks.forEach((link) => {
      if (link.getAttribute("href") === hash) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  function setupCommandPalette() {
    if (!commandPalette || !commandInput || !commandResults) return;
    commandPaletteTrigger?.addEventListener("click", openCommandPalette);
    document
      .getElementById("command-close-btn")
      ?.addEventListener("click", closeCommandPalette);
    document.addEventListener("keydown", (event) => {
      if (!event || typeof event.key !== "string") return;

      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        openCommandPalette();
      }

      if (
        event.key === "Escape" &&
        !commandPalette.classList.contains("hidden")
      ) {
        closeCommandPalette();
      }
    });
    commandInput.addEventListener("input", renderCommandResults);
    commandPalette.addEventListener("click", () => {});
  }

  function getSearchableCommands() {
    if (!isLoggedIn()) {
      return [
        {
          id: "home",
          label: "Go to Home",
          action: () => navigateTo("#home"),
        },
        {
          id: "book",
          label: "Book a visit (patients)",
          action: () => navigateTo("#book"),
        },
        {
          id: "medical-reference",
          label: "Open Medical Reference",
          action: () => window.open("https://medreftool.netlify.app", "_blank", "noopener,noreferrer"),
        },
        {
          id: "pricing",
          label: "View Pricing Tiers",
          action: () => navigateTo("#pricing"),
        },
      ];
    }
    const staffRoles = new Set(["doctor", "receptionist", "admin"]);
    const userRole = String(getCurrentUserRole() || "");
    const staticCommands = [
      {
        id: "home",
        label: "Go to Home",
        action: () => navigateTo("#home"),
      },
      {
        id: "book",
        label: "Book a visit (patients)",
        action: () => navigateTo("#book"),
      },
      {
        id: "patients",
        label: "Go to Patients",
        action: () => navigateTo("#patients"),
      },
      {
        id: "appointments",
        label: "Go to Appointments",
        action: () => navigateTo("#appointments"),
      },
      {
        id: "medical-reference",
        label: "Open Medical Reference",
        action: () => window.open("https://medreftool.netlify.app", "_blank", "noopener,noreferrer"),
      },
      {
        id: "pricing",
        label: "View Pricing Tiers",
        action: () => navigateTo("#pricing"),
      },
      ...(isLoggedIn() && (userRole === "doctor" || userRole === "receptionist")
        ? [
            (localStorage.getItem("subscription_plan") || "starter") === "starter"
              ? {
                  id: "upgrade-pro",
                  label: "Upgrade to Clinic Pro",
                  action: () => {
                    navigateTo("#pricing");
                    setTimeout(() => {
                      document.getElementById("pricing-btn-pro")?.click();
                    }, 100);
                  },
                }
              : {
                  id: "manage-sub",
                  label: "Manage Subscription (Cancel Pro)",
                  action: () => {
                    navigateTo("#settings");
                    setTimeout(() => {
                      document.getElementById("settings-cancel-sub-btn")?.click();
                    }, 100);
                  },
                },
          ]
        : []),
      ...(staffRoles.has(userRole)
        ? [
            {
              id: "calendar",
              label: "Go to Calendar",
              action: () => navigateTo("#calendar"),
            },
            {
              id: "users",
              label: "Go to Users",
              action: () => navigateTo("#users"),
            },
          ]
        : []),
      {
        id: "settings",
        label: "Go to Settings",
        action: () => navigateTo("#settings"),
      },
    ];
    if (getCurrentUserRole() === "doctor") {
      staticCommands.splice(1, 0, {
        id: "doctor-dashboard",
        label: "Clinical dashboard",
        action: () => navigateTo("#doctor-dashboard"),
      });
    }
    return staticCommands;
  }

  function openCommandPalette() {
    commandPalette.classList.remove("hidden");
    commandInput.value = "";
    renderCommandResults();
    commandInput.focus();
  }

  function closeCommandPalette() {
    commandPalette.classList.add("hidden");
  }

  function renderCommandResults() {
    const query = commandInput.value.trim().toLowerCase();
    const matches = getSearchableCommands().filter((item) =>
      item.label.toLowerCase().includes(query),
    );
    commandResults.innerHTML =
      matches
        .map(
          (item) =>
            `<li><button type="button" data-command-id="${item.id}" class="command-item">${item.label}</button></li>`,
        )
        .join("") || '<li class="empty">No matches found.</li>';
    commandResults.querySelectorAll("[data-command-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const command = matches.find(
          (entry) => entry.id === button.dataset.commandId,
        );
        if (!command) return;
        command.action();
        closeCommandPalette();
      });
    });
  }

  function navigateTo(hash) {
    window.location.hash = hash;
    renderPage();
  }

  function renderTopbarBreadcrumbs() {
    const container = document.getElementById("topbar-nav-tools");
    if (!container) return;
    const route = getHashRoute();
    const userRole = String(getCurrentUserRole() || "").toLowerCase();

    const isSuperAdmin = userRole === "super_admin";
    const isHospitalAdmin = userRole === "hospital_admin" || userRole === "admin";
    const isDoctor = userRole === "doctor";
    const isPatient = userRole === "patient";
    const isReceptionist = userRole === "receptionist";
    const isNurse = userRole === "nurse";
    const isStaff = isDoctor || isNurse || isReceptionist || isHospitalAdmin || isSuperAdmin;

    let pages = [];
    if (isSuperAdmin) {
      pages = [
        { hash: "#home", label: "Home" },
        { hash: "#users", label: "Users" },
        { hash: "#enterprise", label: "Enterprise" },
        { hash: "#settings", label: "Settings" },
      ];
    } else if (isHospitalAdmin) {
      pages = [
        { hash: "#home", label: "Home" },
        { hash: "#patients", label: "Patients" },
        { hash: "#appointments", label: "Appointments" },
        { hash: "#calendar", label: "Calendar" },
        { hash: "#users", label: "Users" },
        { hash: "#settings", label: "Settings" },
      ];
    } else if (isDoctor) {
      pages = [
        { hash: "#home", label: "Home" },
        { hash: "#doctor-dashboard", label: "Clinical" },
        { hash: "#patients", label: "Patients" },
        { hash: "#appointments", label: "Appointments" },
        { hash: "#pricing", label: "Pricing" },
      ];
    } else {
      pages = [
        { hash: "#home", label: "Home" },
        { hash: "#book", label: "Book" },
        { hash: "#patients", label: "Patients" },
        { hash: "#appointments", label: "Appointments" },
      ];
    }

    // Role-based Sidebar Link Visibility Control
    document.querySelectorAll(".nav-li-doctor-dash").forEach((el) => {
      el.style.display = isDoctor ? "" : "none";
    });

    document.querySelectorAll(".nav-li-non-doctor-patients").forEach((el) => {
      el.style.display = (isDoctor || isSuperAdmin) ? "none" : "";
    });

    document.querySelectorAll(".nav-li-non-doctor").forEach((el) => {
      el.style.display = (isDoctor || isSuperAdmin) ? "none" : "";
    });

    document.querySelectorAll(".nav-li-staff-only").forEach((el) => {
      if (el.querySelector('a[href="#calendar"]')) {
        el.style.display = (isHospitalAdmin || isReceptionist || isNurse || isDoctor) ? "" : "none";
      } else if (el.querySelector('a[href="#users"]')) {
        el.style.display = (isSuperAdmin || isHospitalAdmin) ? "" : "none";
      } else {
        el.style.display = (isSuperAdmin || isHospitalAdmin) ? "" : "none";
      }
    });

    document.querySelectorAll('a[href="#pricing"]').forEach((el) => {
      const parentLi = el.closest("li") || el;
      parentLi.style.display = (isPatient || isSuperAdmin) ? "none" : "";
    });

    const crumbs = pages
      .map((page) => {
        const isActive = page.hash === route;
        return isActive
          ? `<span>${page.label}</span>`
          : `<a href="${page.hash}">${page.label}</a>`;
      })
      .join(" / ");
    container.innerHTML = `
      <button type="button" class="btn btn-secondary btn-sm icon-btn" id="topbar-back-btn" aria-label="Back"><img src="/images/arrow-left-s-line.svg" alt="" /> Back</button>
      <nav class="breadcrumbs">${crumbs}</nav>
      <div class="topbar-actions-right" style="display: flex; align-items: center; gap: 0.5rem; margin-left: auto;">
        <button type="button" class="btn btn-secondary btn-sm icon-btn" id="topbar-settings-btn" aria-label="Settings" title="Settings" style="display: inline-flex; align-items: center; gap: 0.25rem;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          Settings
        </button>
        <button type="button" class="btn btn-secondary btn-sm icon-btn" id="theme-toggle-btn" aria-label="Toggle theme"></button>
      </div>
    `;
    container.querySelector("#topbar-settings-btn")?.addEventListener("click", () => {
      navigateTo("#settings");
    });
    container.querySelector("#topbar-back-btn")?.addEventListener("click", () => {
      window.history.back();
    });
    const themeBtn = container.querySelector("#theme-toggle-btn");
    const isDark = document.body.classList.contains("theme-dark");
    if (themeBtn) {
      themeBtn.innerHTML = `<img src="/images/${isDark ? "contrast-2-fill.svg" : "contrast-2-line.svg"}" alt="" /> ${isDark ? "Dark" : "Light"}`;
      themeBtn.addEventListener("click", () => {
        applyTheme(isDark ? "light" : "dark");
        renderTopbarBreadcrumbs();
      });
    }
  }

  function getHashRoute() {
    const hash = window.location.hash || "#home";
    const route = hash.split("?")[0] || "#home";
    if (route.startsWith("#hospital/") || route.startsWith("hospital/")) {
      return "#enterprise";
    }
    return route;
  }

  async function handleHospitalSlugRoute() {
    const raw = window.location.hash || "";
    const match = raw.match(/#?\/?hospital\/([^/?#]+)/i);
    if (match && match[1]) {
      const slug = match[1];
      try {
        const token = localStorage.getItem("token") || "";
        const res = await fetch(`/api/organization/by-slug/${encodeURIComponent(slug)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const org = await res.json();
          if (org && org._id) {
            window.activeOrgId = String(org._id);
            window._selectedOrgId = String(org._id);
            if (typeof localStorage !== "undefined") {
              localStorage.setItem("drmeet_active_org_id", String(org._id));
            }
          }
        }
      } catch (err) {
        console.warn("Error resolving hospital slug route:", err);
      }
    }
  }

  function renderPage() {
    const raw = window.location.hash || "";
    const route = getHashRoute();
    const role = String(getCurrentUserRole() || "").toLowerCase();

    // Strict Role-Based Route Protection Guard
    if (role === "super_admin") {
      const allowed = new Set(["#home", "#users", "#enterprise", "#pricing", "#settings", "#privacy", "#login", "#signup"]);
      if (!allowed.has(route)) {
        window.location.hash = "#users";
        return;
      }
    } else if (role === "hospital_admin" || role === "admin") {
      const allowed = new Set(["#home", "#users", "#patients", "#appointments", "#calendar", "#enterprise", "#pricing", "#settings", "#privacy", "#login", "#signup"]);
      if (!allowed.has(route)) {
        window.location.hash = "#patients";
        return;
      }
    } else if (role === "patient") {
      const allowed = new Set(["#home", "#book", "#patients", "#appointments", "#settings", "#privacy", "#login", "#signup"]);
      if (!allowed.has(route)) {
        window.location.hash = "#home";
        return;
      }
    } else if (role === "doctor") {
      const allowed = new Set(["#home", "#doctor-dashboard", "#patients", "#appointments", "#calendar", "#book", "#pricing", "#settings", "#privacy", "#login", "#signup"]);
      if (!allowed.has(route)) {
        window.location.hash = "#doctor-dashboard";
        return;
      }
    }

    if (raw.includes("hospital/")) {
      setActiveNav("#enterprise");
      renderTopbarBreadcrumbs();
      void handleHospitalSlugRoute().then(() => {
        if (typeof renderers.renderEnterpriseView === "function") {
          renderers.renderEnterpriseView();
        }
        document.body.classList.remove("auth-loading");
      });
      return;
    }

    setActiveNav(route);
    renderTopbarBreadcrumbs();
    switch (route) {
      case "#doctor-dashboard":
        renderers.renderDoctorDashboard();
        break;
      case "#enterprise":
        if (typeof renderers.renderEnterpriseView === "function") {
          renderers.renderEnterpriseView();
        }
        break;
      case "#settings":
        void renderers.renderSettings();
        break;
      case "#pricing":
        if (role === "patient" || role === "super_admin") {
          window.location.hash = role === "patient" ? "#book" : "#users";
          renderPage();
          return;
        }
        renderers.renderPricing();
        break;
      case "#privacy":
        renderers.renderPrivacy();
        break;
      case "#patients":
        renderers.renderPatients();
        break;
      case "#doctors":
        window.location.hash = "#doctor-dashboard?tab=settings";
        renderers.renderDoctorDashboard();
        break;
      case "#appointments":
        if (role === "doctor") {
          window.location.hash = "#doctor-dashboard?tab=appointments";
          renderers.renderDoctorDashboard();
        } else {
          renderers.renderAppointments();
        }
        break;
      case "#calendar":
        renderers.renderCalendar();
        break;
      case "#users":
        renderers.renderUsers();
        break;
      case "#login":
        renderers.renderLogin();
        break;
      case "#signup":
        void renderers.renderSignup();
        break;
      case "#book":
        renderers.renderPatientBooking();
        break;
      default:
        renderers.renderHome();
    }
    document.body.classList.remove("auth-loading");
  }

  function registerNavigationEvents() {
    window.addEventListener("hashchange", renderPage);
  }

  return {
    getSignupRoleFromHash,
    parseDoctorDashboardTab,
    registerNavigationEvents,
    renderPage,
    renderTopbarBreadcrumbs,
    setDoctorDashboardHashTab,
    setupCommandPalette,
  };
}
