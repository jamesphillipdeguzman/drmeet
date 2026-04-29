import dotenv from 'dotenv';
import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { validateUserSignup } from '../middlewares/user.validation.middleware.js';
import User from '../models/user.model.js';

// Load environment variables
dotenv.config();

const router = express.Router();

// Initiate Google OAuth login
/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: Redirect user to Google OAuth for login
 *     tags:
 *       - Authentication
 *     responses:
 *       302:
 *         description: Initiate Google OAuth login via browser
 */
router.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  }),
);

// Google OAuth callback url for login
/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     summary: Google OAuth callback url for login
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: OAuth login success, JWT returned to client via postMessage
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<script>window.opener.postMessage({ token: 'JWT_TOKEN' })</script>"
 *       302:
 *         description: Redirect if login fails
 */
router.get('/auth/google/callback', (req, res, next) => {
  const clientOrigin = process.env.CLIENT_ORIGIN || 'https://drmeeet.netlify.app';

  // If someone hits the callback URL directly without the OAuth query params,
  // passport-google-oauth20 will throw "Bad Request". Redirect instead of returning JSON.
  if (!req.query || (!req.query.code && !req.query.error)) {
    return res.redirect(`${clientOrigin}/#login?oauth=missing_code`);
  }

  passport.authenticate('google', { session: true }, (err, user) => {
    if (err) {
      console.error('Google OAuth callback error:', err);
      return res.redirect(
        `${clientOrigin}/#login?oauth=failed&reason=${encodeURIComponent(err.message || 'oauth_error')}`,
      );
    }

    if (!user) {
      return res.redirect(`${clientOrigin}/#login?oauth=failed`);
    }

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('Session login error:', loginErr);
        return res.redirect(
          `${clientOrigin}/#login?oauth=session_login_failed&reason=${encodeURIComponent(loginErr.message || 'login_error')}`,
        );
      }

      // Create JWT payload
      const payload = {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email || null,
        role: user.role,
      };

      // Sign JWT with secret and expiration
      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '1h',
      });

      const tokenForScript = JSON.stringify(token);
      const clientOriginForScript = JSON.stringify(clientOrigin);

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.redirect(`${clientOrigin}/#login?oauth=session_save_failed`);
        }

        // Persist JWT for non-SP clients (Swagger / direct browser) that don't send Authorization headers.
        res.cookie('drmeet_token', token, {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          maxAge: 1000 * 60 * 60,
          path: '/',
        });

        return res.send(`
              <html>
                <body>
                  <script>
                    if (window.opener) {
                      window.opener.postMessage(
                        {
                          type: 'GOOGLE_AUTH_SUCCESS',
                          token: ${tokenForScript},
                        },
                        ${clientOriginForScript}
                      );
                      window.close();
                    } else {
                      window.location.href = ${clientOriginForScript};
                    }
                  </script>
                </body>
              </html>
          `);
      });
    });
  })(req, res, next);
});

// Check for current authentication status
/**
 * @swagger
 * /auth/status:
 *   get:
 *     summary: Check the current authentication status
 *     description: Returns whether the user is currently authenticated and includes user profile if logged in
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: Returns auth status and user data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authenticated:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     displayName:
 *                       type: string
 *                       example: James Phillip De Guzman
 *                     emails:
 *                        type: array
 *                        items:
 *                          type: object
 *                          properties:
 *                            value:
 *                              type: string
 *                              example: jamesphillipdeguzman@gmail.com
 */
router.get('/auth/status', (req, res) => {
  let authenticated = false;
  let user = null;

  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader) {
    // Use regext to extract token safely
    const tokenMatch = authHeader.match(/^Bearer (.+)$/);
    token = tokenMatch ? tokenMatch[1] : null;
  }

  // Support cookie-based token checks when Authorization header is not provided.
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)drmeet_token=([^;]+)/);
    if (match?.[1]) {
      token = decodeURIComponent(match[1]);
    }
  }

  if (token) {
    try {
      user = jwt.verify(token, process.env.JWT_SECRET);
      authenticated = true;
    } catch (error) {
      console.error('JWT verification failed', error.message);
      authenticated = false;
    }
  } else {
    authenticated = req.isAuthenticated();
    user = req.user || null;
  }

  res.json({ authenticated, user });
});

/**
 * @swagger
 * /logout:
 *   get:
 *     summary: Logs out the current user and redirects to home
 *     tags:
 *       - Authentication
 *     responses:
 *       302:
 *         description: Redirects to homepage after logout
 */
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);

    req.session.destroy((err) => {
      if (err) {
        console.log('Failed to destroy session during logout:', err);
      }
      // Clear the cookie so browser removes session cookie
      res.clearCookie('connect.sid', {
        path: '/',
        sameSite: 'none',
        secure: true,
      });
      res.redirect('/');
    });
  });
});

// Set a secure test cookie
/**
 * @swagger
 * /set-cookie:
 *   get:
 *     summary: Set a secure, test cookie
 *     description: Useful for debugging cookie behavior
 *     tags:
 *       - Development
 *     responses:
 *       200:
 *         description: Cookie set successfully
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Cookie set
 */
router.get('/set-cookie', (req, res) => {
  res.cookie('test', 'cookie-value', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 60000,
  });
  res.send('Cookie set');
});

router.post('/', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).lean();
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const payload = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    return res.status(200).json({ token });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - password
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, doctor, patient]
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input or user already exists
 *       500:
 *         description: Server error
 */
router.post('/auth/signup', validateUserSignup, async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, address, role } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
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
      role: role || 'user',
    });
    const payload = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
