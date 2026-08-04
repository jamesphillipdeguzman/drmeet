import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

// Load environment variables
dotenv.config();

export const ensureAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }

    res.status(401).json({
        message: 'You are not authorized to view or use this resource',
    });
};

export function normalizeRole(role) {
    if (!role) return '';
    const r = String(role).trim().toLowerCase();
    if (r === 'admin' || r === 'hospital_admin' || r === 'hospitaladmin') {
        return 'hospital_admin';
    }
    if (r === 'superadmin' || r === 'super_admin') {
        return 'super_admin';
    }
    if (r === 'billing' || r === 'billing_specialist' || r === 'billingspecialist') {
        return 'billing_specialist';
    }
    if (r === 'lab' || r === 'lab_technician' || r === 'labtechnician') {
        return 'lab_technician';
    }
    return r;
}

export function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader)
        return res.status(401).json({ message: 'Missing Authorization' });

    const tokenMatch = authHeader.match(/^Bearer (.+)$/);
    const token = tokenMatch ? tokenMatch[1] : null;
    if (!token) return res.status(401).json({ message: 'Missing token' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded.role) {
            decoded.role = normalizeRole(decoded.role);
            if (decoded.role === 'super_admin') {
                decoded.isSuperAdmin = true;
                decoded.subscriptionPlan = decoded.subscriptionPlan || 'enterprise';
                decoded.tier = decoded.tier || 'enterprise';
            }
        }
        req.user = decoded;
        next();
    } catch (err) {
        const expired = err?.name === 'TokenExpiredError';
        return res.status(401).json({
            message: expired
                ? 'Session expired. Please log in again.'
                : 'Invalid or expired token',
            error: err.message,
            code: expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        });
    }
}

export function hybridAuth(req, res, next) {
    if (req.isAuthenticated()) {
        if (req.user && req.user.role) {
            req.user.role = normalizeRole(req.user.role);
            if (req.user.role === 'super_admin') {
                req.user.isSuperAdmin = true;
                req.user.subscriptionPlan = req.user.subscriptionPlan || 'enterprise';
                req.user.tier = req.user.tier || 'enterprise';
            }
        }
        return next();
    }

    const authHeader = req.headers.authorization;
    if (authHeader) {
        const tokenMatch = authHeader.match(/^Bearer (.+)$/);
        const token = tokenMatch ? tokenMatch[1] : null;

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded && decoded.role) {
                decoded.role = normalizeRole(decoded.role);
                if (decoded.role === 'super_admin') {
                    decoded.isSuperAdmin = true;
                    decoded.subscriptionPlan = decoded.subscriptionPlan || 'enterprise';
                    decoded.tier = decoded.tier || 'enterprise';
                }
            }
            req.user = decoded;
            return next();
        } catch (err) {
            const expired = err?.name === 'TokenExpiredError';
            return res.status(401).json({
                message: expired
                    ? 'Session expired. Please log in again.'
                    : 'Invalid token',
                error: err.message,
                code: expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
            });
        }
    }

    return res.status(401).json({
        message: 'You are not authorized to view/use this resource',
    });
}

export function requireRoles(roles = []) {
    const allowed = new Set(roles.map(normalizeRole));
    return (req, res, next) => {
        const role = normalizeRole(req.user?.role || '');
        const orgRole = String(req.user?.orgRole || '').toLowerCase();
        const isSuperAdmin = req.user?.isSuperAdmin === true || role === 'super_admin' || orgRole === 'org_admin';

        if (allowed.has('hospital_admin') && (role === 'hospital_admin' || role === 'admin')) {
            return next();
        }

        if (isSuperAdmin && (allowed.has('super_admin') || allowed.has('hospital_admin'))) {
            return next();
        }

        if (!allowed.has(role)) {
            return res.status(403).json({ error: 'Forbidden.' });
        }
        return next();
    };
}