const express = require('express');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

const router = express.Router();

function client() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function allowedEmails() {
  return (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
}

router.get('/google', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, { httpOnly: true, signed: true, maxAge: 10 * 60 * 1000, sameSite: 'lax' });
  const url = client().generateAuthUrl({
    scope: ['openid', 'email'],
    prompt: 'select_account',
    state,
  });
  res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
  const expectedState = req.signedCookies.oauth_state;
  res.clearCookie('oauth_state');
  if (!expectedState || req.query.state !== expectedState) {
    return res.redirect('/access-denied');
  }
  try {
    const { tokens } = await client().getToken(req.query.code);
    const ticket = await client().verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (payload.email_verified && allowedEmails().includes(payload.email)) {
      res.cookie('session', payload.email, {
        httpOnly: true,
        signed: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
      });
      return res.redirect('/');
    }
    return res.redirect('/access-denied');
  } catch {
    return res.redirect('/access-denied');
  }
});

router.get('/logout', (req, res) => {
  res.clearCookie('session');
  res.redirect('/');
});

router.get('/me', (req, res) => {
  const email = req.signedCookies.session;
  if (email && allowedEmails().includes(email)) return res.json({ email });
  return res.status(401).json({ error: 'unauthorized' });
});

function requireAuth(req, res, next) {
  if (!process.env.GOOGLE_CLIENT_ID) return next();
  if (allowedEmails().includes(req.signedCookies.session)) return next();
  if (req.path.startsWith('/api')) return res.status(401).json({ error: 'unauthorized' });
  return res.redirect('/auth/google');
}

module.exports = { router, requireAuth };
