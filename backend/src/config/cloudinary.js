import { v2 as cloudinary } from 'cloudinary';

function trimEnv(value) {
  if (value == null) return '';
  let s = String(value).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * Reads credentials from discrete env vars, or fills gaps from CLOUDINARY_URL
 * (cloudinary://API_KEY:API_SECRET@CLOUD_NAME).
 */
function readCredentialsFromEnv() {
  let cloud_name = trimEnv(process.env.CLOUDINARY_CLOUD_NAME);
  let api_key = trimEnv(process.env.CLOUDINARY_API_KEY);
  let api_secret = trimEnv(
    process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_SECRET,
  );

  const url = trimEnv(process.env.CLOUDINARY_URL);
  if (url && (!cloud_name || !api_key || !api_secret)) {
    try {
      const u = new URL(url);
      if (u.protocol === 'cloudinary:') {
        api_key = api_key || trimEnv(decodeURIComponent(u.username || ''));
        api_secret =
          api_secret || trimEnv(decodeURIComponent(u.password || ''));
        cloud_name = cloud_name || trimEnv(u.hostname || '');
      }
    } catch {
      // ignore invalid URL
    }
  }

  return { cloud_name, api_key, api_secret };
}

/** True when env (or CLOUDINARY_URL) provides all three values — use instead of cloudinary.config() return shape. */
export function isCloudinaryConfigured() {
  const { cloud_name, api_key, api_secret } = readCredentialsFromEnv();
  return Boolean(cloud_name && api_key && api_secret);
}

/** Call before uploads; safe to call repeatedly (fixes ESM init order / late env). */
export function syncCloudinaryFromEnv() {
  const { cloud_name, api_key, api_secret } = readCredentialsFromEnv();
  cloudinary.config({
    cloud_name,
    api_key,
    api_secret,
    secure: true,
  });
  return Boolean(cloud_name && api_key && api_secret);
}

syncCloudinaryFromEnv();

export default cloudinary;
