export function rowsToCsv(rows = []) {
  if (window.DrMeetUtils?.rowsToCsv) {
    return window.DrMeetUtils.rowsToCsv(rows);
  }
  return "";
}

export function escapeHtml(value) {
  if (window.DrMeetUtils?.escapeHtml) {
    return window.DrMeetUtils.escapeHtml(value);
  }
  return String(value || "");
}

export function showToast(message, type = "success") {
  const hostId = "global-toast-host";
  let host = document.getElementById(hostId);
  if (!host) {
    host = document.createElement("div");
    host.id = hostId;
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  const toast = document.createElement("div");
  toast.className = `toast-item ${type === "error" ? "error" : "success"}`;
  toast.textContent = String(message || "");
  host.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 280);
  }, 2800);
}

export function downloadCsv(filename, rows = []) {
  const csv = rowsToCsv(rows);
  if (!csv) {
    showToast("No rows to export.", "error");
    return;
  }
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function showDangerConfirm(message) {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="card danger-modal modal-card-with-close">
        <button type="button" class="modal-close-x" aria-label="Close" id="danger-confirm-close">&times;</button>
        <h3>Confirm Delete</h3>
        <p>${escapeHtml(message || "This action is irreversible.")}</p>
        <p class="danger-hint">This action is irreversible.</p>
        <div class="modal-form-actions">
          <button type="button" class="btn btn-action-delete" id="danger-confirm-ok">Delete</button>
          <button type="button" class="btn btn-secondary" id="danger-confirm-cancel">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = (value) => {
      modal.remove();
      resolve(value);
    };
    modal
      .querySelector("#danger-confirm-ok")
      ?.addEventListener("click", () => close(true));
    modal
      .querySelector("#danger-confirm-cancel")
      ?.addEventListener("click", () => close(false));
    modal
      .querySelector("#danger-confirm-close")
      ?.addEventListener("click", () => close(false));
  });
}

export function showCustomConfirm({
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  details = null,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "primary",
} = {}) {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.style.zIndex = "10000";
    modal.innerHTML = `
      <div class="card modal-card-with-close" style="max-width: 460px; width: 90%; padding: 1.5rem; border-radius: 16px; background: #ffffff; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);">
        <button type="button" class="modal-close-x" aria-label="Close" id="custom-confirm-close">&times;</button>
        <h3 style="margin-top: 0; margin-bottom: 0.5rem; font-size: 1.25rem; color: #0f172a; font-weight: 700;">${escapeHtml(title)}</h3>
        <p style="margin-bottom: 1rem; font-size: 0.95rem; color: #475569; line-height: 1.5; white-space: pre-line;">${escapeHtml(message)}</p>
        ${details ? `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.85rem; margin-bottom: 1.25rem; font-size: 0.875rem; color: #334155; line-height: 1.6; white-space: pre-line;">${escapeHtml(details)}</div>` : ""}
        <div class="modal-form-actions" style="display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" id="custom-confirm-cancel">${escapeHtml(cancelText)}</button>
          <button type="button" class="btn ${variant === "danger" ? "btn-action-delete" : "btn-primary"}" id="custom-confirm-ok" style="${variant !== "danger" ? "background: #2563eb; color: #ffffff;" : ""}">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = (value) => {
      modal.remove();
      resolve(value);
    };
    modal.querySelector("#custom-confirm-ok")?.addEventListener("click", () => close(true));
    modal.querySelector("#custom-confirm-cancel")?.addEventListener("click", () => close(false));
    modal.querySelector("#custom-confirm-close")?.addEventListener("click", () => close(false));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close(false);
    });
  });
}

export function enforcePhoneInputs(scope = document) {
  const inputs = scope.querySelectorAll(
    'input[name="phone"], input[name="receptionistPhone"]',
  );
  inputs.forEach((input) => {
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("maxlength", "11");
    input.setAttribute("pattern", "[0-9]{10,11}");
    input.addEventListener("input", () => {
      const cleaned = String(input.value || "")
        .replace(/\D+/g, "")
        .slice(0, 11);
      input.value = cleaned;
    });
  });
}

export function addInlineTooltips(scope = document) {
  scope.querySelectorAll("[data-tooltip]").forEach((node) => {
    if (node.querySelector(".info-tooltip-trigger")) return;
    const content = String(node.getAttribute("data-tooltip") || "").trim();
    if (!content) return;
    const trigger = document.createElement("span");
    trigger.className = "info-tooltip-trigger";
    trigger.tabIndex = 0;
    trigger.setAttribute("title", content);
    trigger.setAttribute("aria-label", `Info: ${content}`);
    trigger.innerHTML = `
      <img src="/images/info-i.svg" alt="" class="info-tooltip-icon" role="presentation" />
      <span class="info-tooltip-bubble" role="tooltip">${escapeHtml(content)}</span>
    `;
    node.appendChild(trigger);
  });
}

export function attachClearButtons(scope = document) {
  const fields = scope.querySelectorAll(
    'input[type="text"], input[type="email"], input[type="search"], input[type="password"], input[type="date"], input[type="time"], textarea, select',
  );
  fields.forEach((field) => {
    if (field.closest(".field-input-wrap")) return;
    const wrap = document.createElement("span");
    wrap.className = "field-input-wrap";
    field.parentNode.insertBefore(wrap, field);
    wrap.appendChild(field);
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "field-clear-btn";
    clearBtn.setAttribute("aria-label", `Clear ${field.name || "field"}`);
    clearBtn.textContent = "×";
    wrap.appendChild(clearBtn);

    const syncVisibility = () => {
      const hasValue = String(field.value || "").trim().length > 0;
      clearBtn.classList.toggle("visible", hasValue);
    };
    clearBtn.addEventListener("click", () => {
      if (field.tagName === "SELECT") {
        field.selectedIndex = 0;
      } else {
        field.value = "";
      }
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      syncVisibility();
      field.focus();
    });
    field.addEventListener("input", syncVisibility);
    field.addEventListener("change", syncVisibility);
    syncVisibility();
  });
}

export function fileToDataUrl(file) {
  if (window.DrMeetUtils?.fileToDataUrl) {
    return window.DrMeetUtils.fileToDataUrl(file);
  }
  return Promise.reject(new Error("No file selected."));
}
