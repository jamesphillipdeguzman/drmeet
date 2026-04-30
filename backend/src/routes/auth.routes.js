import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

import { validateUserSignup } from '../middlewares/user.validation.middleware.js';
import User from '../models/user.model.js';

const router = express.Router();

/**
 * Design "User" (ambiguous / general account). Stored role must match User schema enum
 * (no `user` value) — we persist as `patient`.
 */
const GENERAL_USER_ROLE_STORED = 'patient';

function normalizeAmbiguousSignupRole(incoming) {
  const r = String(incoming ?? '')
    .trim()
    .toLowerCase();
  if (r === 'patient') return 'patient';
  return GENERAL_USER_ROLE_STORED;
}

/* =========================================================
   GOOGLE OAUTH
========================================================= */

/**
 * @swagger
 * /api/auth/google:
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  }),
);

/**
 * @swagger
 * /api/auth/google/callback:
 */
router.get('/google/callback', (req, res, next) => {
  const clientOrigin =
    process.env.CLIENT_ORIGIN || 'https://drmeeet.netlify.app';

  if (!req.query || (!req.query.code && !req.query.error)) {
    return res.redirect(`${clientOrigin}/#login?oauth=missing_code`);
  }

  passport.authenticate('google', { session: true }, (err, user) => {
    if (err || !user) {
      return res.redirect(`${clientOrigin}/#login?oauth=failed`);
    }

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        return res.redirect(`${clientOrigin}/#login?oauth=session_error`);
      }

      const payload = {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email || null,
        role: user.role,
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '1h',
      });

      let responded = false;
      const callbackTimeout = setTimeout(() => {
        if (responded) return;
        responded = true;
        return res.redirect(`${clientOrigin}/#login?oauth=callback_timeout`);
      }, 10000);

      req.session.save(() => {
        if (responded) return;
        responded = true;
        clearTimeout(callbackTimeout);
        res.cookie('drmeet_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          maxAge: 1000 * 60 * 60,
          path: '/',
        });

        return res.send(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage(
                    { type: 'GOOGLE_AUTH_SUCCESS', token: ${JSON.stringify(token)} },
                    ${JSON.stringify(clientOrigin)}
                  );
                  window.close();
                } else {
                  window.location.href = ${JSON.stringify(clientOrigin)};
                }
              </script>
            </body>
          </html>
        `);
      });
    });
  })(req, res, next);
});

/* =========================================================
   AUTH STATUS
========================================================= */

/**
 * @swagger
 * /api/auth/status:
 */
router.get('/status', (req, res) => {
  let token = null;
  let user = null;
  let authenticated = false;

  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/drmeet_token=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]);
  }

  if (token) {
    try {
      user = jwt.verify(token, process.env.JWT_SECRET);
      authenticated = true;
    } catch {
      authenticated = false;
    }
  } else {
    authenticated = req.isAuthenticated();
    user = req.user || null;
  }

  res.json({ authenticated, user });
});

/* =========================================================
   LOGOUT
========================================================= */

/**
 * @swagger
 * /api/auth/logout:
 */
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);

    req.session.destroy(() => {
      res.clearCookie('connect.sid', {
        path: '/',
        sameSite: 'none',
        secure: process.env.NODE_ENV === 'production',
      });

      res.clearCookie('drmeet_token', {
        path: '/',
        sameSite: 'none',
        secure: process.env.NODE_ENV === 'production',
      });

      res.redirect('/');
    });
  });
});

/* =========================================================
   LOGIN (EMAIL/PASSWORD)
========================================================= */

/**
 * @swagger
 * /api/auth/login:
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    const user = await User.findOne({ email }).lean();

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        _id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   SIGNUP
========================================================= */

/**
 * @swagger
 * /api/auth/signup:
 */
router.post('/signup', validateUserSignup, async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, address } = req.body;

    const exists = await User.findOne({ email });

    if (exists) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      firstName,
      lastName,
      email,
      password: hashed,
      phone,
      address,
      role: normalizeAmbiguousSignupRole(req.body.role),
    });

    const token = jwt.sign(
      {
        _id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
    );

    res.status(201).json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;