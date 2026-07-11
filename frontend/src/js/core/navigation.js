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
        id: "doctors",
        label: "Go to Doctors",
        action: () => navigateTo("#doctors"),
      },
      {
        id: "appointments",
        label: "Go to Appointments",
        action: () => navigateTo("#appointments"),
      },
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
    const staffRoles = new Set(["doctor", "receptionist", "admin"]);
    const userRole = String(getCurrentUserRole() || "");
    const pages = [
      { hash: "#home", label: "Home" },
      { hash: "#doctor-dashboard", label: "Clinical" },
      { hash: "#book", label: "Book" },
      { hash: "#patients", label: "Patients" },
      { hash: "#doctors", label: "Doctors" },
      { hash: "#appointments", label: "Appointments" },
      ...(staffRoles.has(userRole)
        ? [
            { hash: "#calendar", label: "Calendar" },
            { hash: "#users", label: "Users" },
          ]
        : []),
      { hash: "#settings", label: "Settings" },
    ];
    const crumbs = pages
      .map((page) => {
        const isActive = page.hash === route;
        return isActive
          ? `<span>${page.label}</span>`
          : `<a href="${page.hash}">${page.label}</a>`;
      })
      .join(" / ");
    container.innerHTML = `
      <button type="button" class="btn btn-secondary btn-sm icon-btn" id="topbar-back-btn" aria-label="Back"><img src="images/arrow-left-s-line.svg" alt="" /> Back</button>
      <nav class="breadcrumbs">${crumbs}</nav>
      <button type="button" class="btn btn-secondary btn-sm icon-btn" id="theme-toggle-btn" aria-label="Toggle theme"></button>
    `;
    container.querySelector("#topbar-back-btn")?.addEventListener("click", () => {
      window.history.back();
    });
    const themeBtn = container.querySelector("#theme-toggle-btn");
    const isDark = document.body.classList.contains("theme-dark");
    if (themeBtn) {
      themeBtn.innerHTML = `<img src="images/${isDark ? "contrast-2-fill.svg" : "contrast-2-line.svg"}" alt="" /> ${isDark ? "Dark" : "Light"}`;
      themeBtn.addEventListener("click", () => {
        applyTheme(isDark ? "light" : "dark");
        renderTopbarBreadcrumbs();
      });
    }
  }

  function renderPage() {
    const route = getHashRoute();
    setActiveNav(route);
    renderTopbarBreadcrumbs();
    switch (route) {
      case "#doctor-dashboard":
        renderers.renderDoctorDashboard();
        break;
      case "#settings":
        void renderers.renderSettings();
        break;
      case "#privacy":
        renderers.renderPrivacy();
        break;
      case "#patients":
        renderers.renderPatients();
        break;
      case "#doctors":
        renderers.renderDoctors();
        break;
      case "#appointments":
        renderers.renderAppointments();
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
