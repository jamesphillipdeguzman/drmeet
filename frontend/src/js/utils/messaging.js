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

  window.DrMeetUtils = {
    ...(window.DrMeetUtils || {}),
    normalizeFetchErrorMessage,
    getApiErrorMessage,
  };
})();
