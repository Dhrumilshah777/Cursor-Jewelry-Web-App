const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const hasGoogleConfig = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

if (hasGoogleConfig) {
  // Single Google OAuth: one callback; role (admin vs user) decided in auth route
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
}

module.exports = passport;
