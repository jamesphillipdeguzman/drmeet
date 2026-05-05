(() => {
  function rowsToCsv(rows = []) {
    if (!Array.isArray(rows) || !rows.length) return "";
    const headers = Object.keys(rows[0]);
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const body = rows
      .map((row) => headers.map((h) => escape(row[h])).join(","))
      .join("\n");
    return `${headers.join(",")}\n${body}`;
  }

  window.DrMeetUtils = { ...(window.DrMeetUtils || {}), rowsToCsv };
})();
