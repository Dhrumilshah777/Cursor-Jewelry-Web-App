const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const hasGoogleConfig = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

/**
 * Public origin of this API (must match Google Cloud "Authorized redirect URIs").
 * Order: explicit BACKEND_URL → Render auto URL → optional PUBLIC_API_URL → localhost dev.
 */
function resolveBackendPublicUrl() {
  const raw =
    process.env.BACKEND_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.PUBLIC_API_URL ||
    '';
  let url = String(raw).trim();
  if (!url) return 'http://localhost:5000';
  url = url.replace(/\/+$/, '');
  return url;
}

const backendUrl = resolveBackendPublicUrl();
const googleCallbackPath = '/api/auth/google/callback';
const googleCallbackUrl = `${backendUrl}${googleCallbackPath}`;

if (hasGoogleConfig) {
  const isProdish = process.env.NODE_ENV === 'production' || process.env.RENDER;
  if (isProdish && backendUrl.startsWith('http://localhost')) {
    console.warn(
      '[auth] Google OAuth: set BACKEND_URL (or rely on RENDER_EXTERNAL_URL) to your public https API URL. ' +
        'Otherwise the callback URL will not match Google Console and token exchange can fail (e.g. Malformed auth code).'
    );
  } else {
    console.info(`[auth] Google OAuth callback URL: ${googleCallbackUrl}`);
  }

  // Single Google OAuth: one callback; role (admin vs user) decided in auth route
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: googleCallbackUrl,
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
