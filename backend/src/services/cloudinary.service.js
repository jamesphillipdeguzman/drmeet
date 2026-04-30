import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

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
  const result = await cloudinary.uploader.upload(fileData, {
    resource_type: 'auto',
    folder: options.folder || 'drmeet',
    ...options,
  });
  return normalizeUploadResult(result);
}

export async function deleteFromCloudinary(publicId) {
  if (!publicId) return null;
  return cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
}
