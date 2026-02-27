const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const hasGoogleConfig = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

if (hasGoogleConfig) {
  // Admin Google OAuth (callback to /api/auth/google/callback)
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${backendUrl}/api/auth/google/callback`,
      },
      (accessToken, refreshToken, profile, done) => {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error('No email from Google'));
        return done(null, { id: profile.id, email, name: profile.displayName });
      }
    )
  );

  // Customer Google OAuth (callback to /api/auth/google/user/callback)
  passport.use(
    'google-user',
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${backendUrl}/api/auth/google/user/callback`,
      },
      (accessToken, refreshToken, profile, done) => {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error('No email from Google'));
        return done(null, { id: profile.id, email, name: profile.displayName });
      }
    )
  );
}

module.exports = passport;
