import dotenv from 'dotenv';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/user.model.js';

dotenv.config();

// Admin emails
const adminEmails = ['jamesphillipdeguzman@gmail.com'].map((e) =>
  e.toLowerCase(),
);

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      console.log('Google profile:', profile);

      try {
        // Check if user already exists
        const existingUser = await User.findOne({ googleId: profile.id });
        if (existingUser) {
          existingUser.lastLogin = new Date();
          await existingUser.save();
          return done(null, existingUser);
        }

        const email = profile.emails?.[0]?.value;
        if (!email) {
          console.error('Missing email in Google profile', profile);
          return done(new Error('Email is required'), null);
        }

        // Ensure name fields are present
        const firstName = profile.name?.givenName;
        const lastName = profile.name?.familyName;
        if (!firstName || !lastName) {
          console.error('Missing required name fields', profile.name);
          return done(new Error('First name and last name are required'), null);
        }

        const normalizedEmail = email.trim().toLowerCase();
        const role = adminEmails.includes(normalizedEmail) ? 'admin' : 'doctor';

        const newUser = await User.create({
          googleId: profile.id,
          firstName,
          lastName,
          email: normalizedEmail,
          picture: profile.photos?.[0]?.value,
          role,
          lastLogin: new Date(),
        });

        return done(null, newUser);
      } catch (err) {
        console.error('User create error', err);
        return done(err, null);
      }
    },
  ),
);

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

export default passport;
