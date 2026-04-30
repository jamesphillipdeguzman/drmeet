import dotenv from 'dotenv';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/user.model.js';
import { ensureDoctorProfileForUser } from '../services/doctorProfileSync.service.js';

dotenv.config();

if (!process.env.GOOGLE_CLIENT_ID) {
  throw new Error('Missing required env: GOOGLE_CLIENT_ID');
}
if (!process.env.GOOGLE_CALLBACK_URL) {
  throw new Error('Missing required env: GOOGLE_CALLBACK_URL');
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error('Missing required env: GOOGLE_CLIENT_SECRET');
}

// ==========================
// ROLE CONFIGURATION
// ==========================
const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const DEFAULT_ROLE = 'patient';

function normalizeRequestedRole(incomingRole) {
  const role = String(incomingRole || '')
    .trim()
    .toLowerCase();
  if (role === 'doctor') return 'doctor';
  if (role === 'receptionist') return 'receptionist';
  if (role === 'patient') return 'patient';
  return DEFAULT_ROLE;
}

function extractRequestedRoleFromState(req) {
  const stateRaw = String(req?.query?.state || '');
  if (!stateRaw) return '';
  try {
    const parsed = JSON.parse(stateRaw);
    return String(parsed?.role || '').toLowerCase();
  } catch {
    return '';
  }
}

async function resolveRole(email, req) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  // 1) Admin allowlist has top priority.
  if (adminEmails.includes(normalizedEmail)) return 'admin';

  // 2) Existing users keep their stored role.
  const existing = await User.findOne({ email: normalizedEmail })
    .select('role')
    .lean();
  if (existing?.role) return String(existing.role).toLowerCase();

  // 3) New users can inherit the requested URL role.
  const requestedRole = extractRequestedRoleFromState(req);
  if (requestedRole) return normalizeRequestedRole(requestedRole);

  // 4) Default fallback.
  return DEFAULT_ROLE;
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        console.log('Google profile:', profile);

        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('Email is required'), null);
        }

        const firstName = profile.name?.givenName;
        const lastName = profile.name?.familyName;

        if (!firstName || !lastName) {
          return done(new Error('First name and last name are required'), null);
        }

        const normalizedEmail = email.trim().toLowerCase();

        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
          user = await User.findOne({ email: normalizedEmail });
        }

        if (user) {
          if (!user.googleId) user.googleId = profile.id;
          user.lastLogin = new Date();
          await user.save();
          await ensureDoctorProfileForUser(user);
          return done(null, user);
        }

        const role = await resolveRole(normalizedEmail, req);
        user = await User.create({
          googleId: profile.id,
          firstName,
          lastName,
          email: normalizedEmail,
          picture: profile.photos?.[0]?.value || '',
          role,
          lastLogin: new Date(),
        });
        await ensureDoctorProfileForUser(user);

        return done(null, user);
      } catch (err) {
        console.error('Google auth error:', err);
        return done(err, null);
      }
    },
  ),
);

// ==========================
// SESSION HANDLERS
// ==========================
passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

export default passport;