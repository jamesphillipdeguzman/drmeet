import dotenv from "dotenv";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.model.js";

dotenv.config();

// ==========================
// ROLE CONFIGURATION
// ==========================
const adminEmails = ["jamesphillipdeguzman@gmail.com"].map((e) =>
  e.toLowerCase()
);

const receptionistEmails = [
  // add receptionist emails here
].map((e) => e.toLowerCase());

// ==========================
// ROLE RESOLVER
// ==========================
const resolveRole = (email) => {
  const normalizedEmail = email.toLowerCase();

  if (adminEmails.includes(normalizedEmail)) return "admin";
  if (receptionistEmails.includes(normalizedEmail)) return "receptionist";

  return "patient";
};

// ==========================
// GOOGLE STRATEGY
// ==========================
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("Google profile:", profile);

        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error("Email is required"), null);
        }

        const firstName = profile.name?.givenName;
        const lastName = profile.name?.familyName;

        if (!firstName || !lastName) {
          return done(
            new Error("First name and last name are required"),
            null
          );
        }

        const normalizedEmail = email.trim().toLowerCase();

        // ==========================
        // CHECK EXISTING USER
        // ==========================
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          user.lastLogin = new Date();
          await user.save();
          return done(null, user);
        }

        // ==========================
        // CREATE NEW USER
        // ==========================
        user = await User.create({
          googleId: profile.id,
          firstName,
          lastName,
          email: normalizedEmail,
          picture: profile.photos?.[0]?.value || "",
          role: resolveRole(normalizedEmail),
          lastLogin: new Date(),
        });

        return done(null, user);
      } catch (err) {
        console.error("Google auth error:", err);
        return done(err, null);
      }
    }
  )
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