(() => {
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

  window.DrMeetUtils = {
    ...(window.DrMeetUtils || {}),
    formatDateForInput,
    formatDateDisplay,
    formatRelativeTime,
  };
})();
