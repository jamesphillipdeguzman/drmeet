import cloudinary, {
  isCloudinaryConfigured,
  syncCloudinaryFromEnv,
} from '../config/cloudinary.js';

const UPLOAD_OPTION_KEYS = new Set([
  'folder',
  'resource_type',
  'public_id',
  'tags',
  'overwrite',
  'use_filename',
  'unique_filename',
  'format',
  'invalidate',
  'access_mode',
  'context',
  'metadata',
]);

function pickUploadOptions(options) {
  const out = {};
  for (const [k, v] of Object.entries(options || {})) {
    if (UPLOAD_OPTION_KEYS.has(k) && v !== undefined) out[k] = v;
  }
  return out;
}

function normalizeUploadResult(result) {
  return {
    secure_url: result?.secure_url || '',
    public_id: result?.public_id || '',
  };
}

export async function uploadToCloudinary(fileData, options = {}) {
  if (!fileData) {
    throw new Error('fileData is required');
  }
  syncCloudinaryFromEnv();
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Cloudinary is not configured on the server. Set CLOUDINARY_URL (recommended) or all of CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the host. Names must match exactly (no spaces). After changing env on Render, trigger a new deploy.',
    );
  }
  const uploadParams = pickUploadOptions({
    folder: 'drmeet',
    resource_type: 'auto',
    ...options,
  });
  const result = await cloudinary.uploader.upload(fileData, uploadParams);
  return normalizeUploadResult(result);
}

export async function deleteFromCloudinary(publicId) {
  if (!publicId) return null;
  syncCloudinaryFromEnv();
  if (!isCloudinaryConfigured()) return null;
  return cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
}
