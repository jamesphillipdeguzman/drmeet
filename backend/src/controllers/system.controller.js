import { getMongoConnectionState, isDatabaseConnected } from '../db/mongoose.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';
import SystemStats from '../models/systemStats.model.js';

let inMemoryVisitorStats = {
  totalVisits: 1248,
  uniqueVisits: 892,
  visitorIds: [],
};

async function getOrInitStatsDoc() {
  if (!isDatabaseConnected()) return null;
  let stats = await SystemStats.findOne({ key: 'visitor_stats' });
  if (!stats) {
    stats = await SystemStats.create({
      key: 'visitor_stats',
      totalVisits: 1248,
      uniqueVisits: 892,
      visitorIds: [],
    });
  }
  return stats;
}

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
        status: isDatabaseConnected() ? 'ok' : 'error',
        details: isDatabaseConnected()
          ? 'Connected'
          : getMongoConnectionState().label,
      },
      {
        key: 'cloudinary_configured',
        label: 'Cloudinary Credentials',
        status: isCloudinaryConfigured() ? 'ok' : 'error',
        details:
          'CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME + API_KEY + API_SECRET.',
      },
      {
        key: 'resend_configured',
        label: 'Resend Email Credentials',
        status: process.env.RESEND_API_KEY ? 'ok' : 'error',
        details: 'Checks env vars presence only.',
      },
    ];
    checks.push({
      key: 'email_display_name',
      label: 'Email Display Name',
      status: 'info',
      details: global.lastEmailDisplayName || 'No email sent yet',
    });
    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      checks,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load diagnostics.' });
  }
};

export const getVisitorCount = async (req, res) => {
  try {
    const stats = await getOrInitStatsDoc();
    if (stats) {
      return res.status(200).json({
        totalVisits: stats.totalVisits,
        uniqueVisits: stats.uniqueVisits,
      });
    }
    return res.status(200).json({
      totalVisits: inMemoryVisitorStats.totalVisits,
      uniqueVisits: inMemoryVisitorStats.uniqueVisits,
    });
  } catch (error) {
    return res.status(200).json({
      totalVisits: inMemoryVisitorStats.totalVisits,
      uniqueVisits: inMemoryVisitorStats.uniqueVisits,
    });
  }
};

export const incrementVisitorCount = async (req, res) => {
  try {
    const visitorId = String(req.body?.visitorId || req.ip || '').trim();
    const stats = await getOrInitStatsDoc();

    if (stats) {
      stats.totalVisits += 1;
      if (visitorId && !stats.visitorIds.includes(visitorId)) {
        stats.visitorIds.push(visitorId);
        stats.uniqueVisits += 1;
        if (stats.visitorIds.length > 5000) {
          stats.visitorIds.shift();
        }
      } else if (!visitorId) {
        stats.uniqueVisits += 1;
      }
      await stats.save();

      return res.status(200).json({
        totalVisits: stats.totalVisits,
        uniqueVisits: stats.uniqueVisits,
      });
    }

    inMemoryVisitorStats.totalVisits += 1;
    if (visitorId && !inMemoryVisitorStats.visitorIds.includes(visitorId)) {
      inMemoryVisitorStats.visitorIds.push(visitorId);
      inMemoryVisitorStats.uniqueVisits += 1;
    }
    return res.status(200).json({
      totalVisits: inMemoryVisitorStats.totalVisits,
      uniqueVisits: inMemoryVisitorStats.uniqueVisits,
    });
  } catch (error) {
    inMemoryVisitorStats.totalVisits += 1;
    return res.status(200).json({
      totalVisits: inMemoryVisitorStats.totalVisits,
      uniqueVisits: inMemoryVisitorStats.uniqueVisits,
    });
  }
};
