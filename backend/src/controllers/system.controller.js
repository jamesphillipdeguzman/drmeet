import mongoose from 'mongoose';

export const getDiagnostics = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    const checks = [
      {
        key: 'api_reachable',
        label: 'API Reachable',
        status: 'ok',
        details: 'Backend route responded successfully.',
      },
      {
        key: 'mongodb_connected',
        label: 'MongoDB Connection',
        status: mongoose.connection.readyState === 1 ? 'ok' : 'error',
        details:
          mongoose.connection.readyState === 1
            ? 'Connected'
            : `readyState=${mongoose.connection.readyState}`,
      },
      {
        key: 'cloudinary_configured',
        label: 'Cloudinary Credentials',
        status:
          process.env.CLOUDINARY_CLOUD_NAME
          && process.env.CLOUDINARY_API_KEY
          && process.env.CLOUDINARY_API_SECRET
            ? 'ok'
            : 'error',
        details: 'Checks env vars presence only.',
      },
      {
        key: 'resend_configured',
        label: 'Resend Email Credentials',
        status: process.env.RESEND_API_KEY ? 'ok' : 'error',
        details: 'Checks env vars presence only.',
      },
    ];
    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      checks,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load diagnostics.' });
  }
};
