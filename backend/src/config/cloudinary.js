import { v2 as cloudinary } from 'cloudinary';

/**
 * Reads credentials from discrete env vars, or fills gaps from CLOUDINARY_URL
 * (cloudinary://API_KEY:API_SECRET@CLOUD_NAME).
 */
function readCredentialsFromEnv() {
  let cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  let api_key = process.env.CLOUDINARY_API_KEY;
  let api_secret = process.env.CLOUDINARY_API_SECRET;

  const url = process.env.CLOUDINARY_URL;
  if (url && (!cloud_name || !api_key || !api_secret)) {
    try {
      const u = new URL(url);
      if (u.protocol === 'cloudinary:') {
        api_key = api_key || decodeURIComponent(u.username || '');
        api_secret = api_secret || decodeURIComponent(u.password || '');
        cloud_name = cloud_name || u.hostname || '';
      }
    } catch {
      // ignore invalid URL
    }
  }

  return { cloud_name, api_key, api_secret };
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
