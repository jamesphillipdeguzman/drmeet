(() => {
  function normalizeFetchErrorMessage(err, fallbackMessage) {
    const message = String(err?.message || "");
    if (
      message.toLowerCase().includes("failed to fetch") ||
      err instanceof TypeError
    ) {
      return "Unable to reach the server right now. Please check your connection and try again.";
    }
    return message || fallbackMessage;
  }

  async function getApiErrorMessage(res, fallbackMessage) {
    try {
      const payload = await res.json();
      if (payload?.error) return payload.error;
      if (Array.isArray(payload?.missingFields) && payload.missingFields.length) {
        return `Missing required fields: ${payload.missingFields.join(", ")}`;
      }
      if (Array.isArray(payload?.errors) && payload.errors.length) {
        return payload.errors
          .map((item) => item.msg || item.message)
          .filter(Boolean)
          .join(", ");
      }
      if (Array.isArray(payload?.details) && payload.details.length) {
        return payload.details.join(", ");
      }
    } catch (error) {
      // ignore parse errors
    }
    return fallbackMessage;
  }

  function formatDateForInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }

  function formatDateDisplay(value) {
    if (!value) return "";
    const date = new Date(value);
    if (isNaN(date)) return value;
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function parseIsoDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatRelativeTime(isoValue) {
    const date = parseIsoDate(isoValue);
    if (!date) return "just now";
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes <= 0) return "just now";
    if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  function decodeJwtPayload(token) {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
          .join(""),
      );
      return JSON.parse(json);
    } catch (error) {
      return null;
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function rowsToCsv(rows = []) {
    if (!Array.isArray(rows) || !rows.length) return "";
    const headers = Object.keys(rows[0]);
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const body = rows
      .map((row) => headers.map((h) => escape(row[h])).join(","))
      .join("\n");
    return `${headers.join(",")}\n${body}`;
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("No file selected."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsDataURL(file);
    });
  }

  window.DrMeetUtils = {
    ...(window.DrMeetUtils || {}),
    normalizeFetchErrorMessage,
    getApiErrorMessage,
    formatDateForInput,
    formatDateDisplay,
    formatRelativeTime,
    decodeJwtPayload,
    escapeHtml,
    rowsToCsv,
    fileToDataUrl,
  };
})();
