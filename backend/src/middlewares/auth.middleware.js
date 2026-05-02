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

export function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader)
        return res.status(401).json({ message: 'Missing Authorization' });

    // Use regex to extract token safely (for edge cases)
    const tokenMatch = authHeader.match(/^Bearer (.+)$/);
    const token = tokenMatch ? tokenMatch[1] : null;
    if (!token) return res.status(401).json({ message: 'Missing token' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
    console.log('AUTH CHECK - Headers:', req.headers);
    console.log('AUTH CHECK - Session:', req.session);
    console.log('AUTH CHECK - req.user before check:', req.user);
    if (req.isAuthenticated()) return next();

    const authHeader = req.headers.authorization;
    if (authHeader) {
        const tokenMatch = authHeader.match(/^Bearer (.+)$/);
        const token = tokenMatch ? tokenMatch[1] : null;

        try {
            req.user = jwt.verify(token, process.env.JWT_SECRET);
            return next();
        } catch (err) {
            const expired = err?.name === 'TokenExpiredError';
            res.status(401).json({
                message: expired
                    ? 'Session expired. Please log in again.'
                    : 'Invalid token',
                error: err.message,
                code: expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
            });
        }
    }

    res.status(401).json({
        message: 'You are not authorized to view/use this resource',
    });
}

export function requireRoles(roles = []) {
    const allowed = new Set(roles.map((r) => String(r).toLowerCase()));
    return (req, res, next) => {
        const role = String(req.user?.role || '').toLowerCase();
        if (!allowed.has(role)) {
            return res.status(403).json({ error: 'Forbidden.' });
        }
        return next();
    };
}