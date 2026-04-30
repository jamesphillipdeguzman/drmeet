function stripPhone(value) {
  return String(value || '').replace(/\D+/g, '');
}

export function sanitizeInput(payload = {}) {
  if (!payload || typeof payload !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string') {
      out[key] = value.trim();
      continue;
    }
    out[key] = value;
  }

  if (typeof out.email === 'string') {
    out.email = out.email.toLowerCase();
  }
  if (typeof out.phone === 'string') {
    out.phone = stripPhone(out.phone);
  }
  if (typeof out.receptionistPhone === 'string') {
    out.receptionistPhone = stripPhone(out.receptionistPhone);
  }
  if (typeof out.emergencyContact?.phone === 'string') {
    out.emergencyContact = {
      ...out.emergencyContact,
      phone: stripPhone(out.emergencyContact.phone),
    };
  }
  return out;
}
