const mockGenerateAuthUrl = jest.fn();
const mockGetToken = jest.fn();
const mockVerifyIdToken = jest.fn();

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    generateAuthUrl: mockGenerateAuthUrl,
    getToken: mockGetToken,
    verifyIdToken: mockVerifyIdToken,
  })),
}));

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const { router, requireAuth } = require('../auth');

const ALLOWED_A = 'noamros9@gmail.com';
const ALLOWED_B = 'maliros164@gmail.com';

function buildApp() {
  const app = express();
  app.use(cookieParser(process.env.SESSION_SECRET));
  app.use('/auth', router);
  app.get('/api/protected', requireAuth, (req, res) => res.json({ ok: true }));
  app.get('/protected-page', requireAuth, (req, res) => res.json({ ok: true }));
  return app;
}

function mockPayload(email, email_verified) {
  mockGetToken.mockResolvedValue({ tokens: { id_token: 'fake-id-token' } });
  mockVerifyIdToken.mockResolvedValue({ getPayload: () => ({ email, email_verified }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:5173/auth/google/callback';
  process.env.ALLOWED_EMAILS = `${ALLOWED_A},${ALLOWED_B}`;
  process.env.SESSION_SECRET = 'test-session-secret';
});

afterEach(() => {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REDIRECT_URI;
  delete process.env.ALLOWED_EMAILS;
  delete process.env.SESSION_SECRET;
});

describe('GET /auth/google', () => {
  it('redirects to the generated Google consent URL', async () => {
    mockGenerateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?mock=1');
    const res = await request(buildApp()).get('/auth/google');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://accounts.google.com/o/oauth2/v2/auth?mock=1');
    expect(mockGenerateAuthUrl).toHaveBeenCalledWith({
      scope: ['openid', 'email'],
      prompt: 'select_account',
    });
  });
});

describe('GET /auth/google/callback', () => {
  it('sets a session cookie and redirects home for an allowlisted, verified email', async () => {
    mockPayload(ALLOWED_A, true);
    const res = await request(buildApp()).get('/auth/google/callback?code=abc');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
    expect(res.headers['set-cookie'][0]).toMatch(/^session=/);
  });

  it('also accepts the second allowlisted email', async () => {
    mockPayload(ALLOWED_B, true);
    const res = await request(buildApp()).get('/auth/google/callback?code=abc');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
    expect(res.headers['set-cookie'][0]).toMatch(/^session=/);
  });

  it('redirects to /access-denied with no cookie for a non-allowlisted email', async () => {
    mockPayload('stranger@gmail.com', true);
    const res = await request(buildApp()).get('/auth/google/callback?code=abc');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/access-denied');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('redirects to /access-denied with no cookie for an unverified email', async () => {
    mockPayload(ALLOWED_A, false);
    const res = await request(buildApp()).get('/auth/google/callback?code=abc');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/access-denied');
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});

describe('GET /auth/logout', () => {
  it('clears the session cookie and redirects home', async () => {
    const res = await request(buildApp()).get('/auth/logout');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
    expect(res.headers['set-cookie'][0]).toMatch(/^session=;/);
  });
});

describe('GET /auth/me', () => {
  it('returns 401 with no cookie', async () => {
    const res = await request(buildApp()).get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'unauthorized' });
  });

  it('returns the email for a logged-in allowlisted user', async () => {
    const app = buildApp();
    const agent = request.agent(app);
    mockPayload(ALLOWED_A, true);
    await agent.get('/auth/google/callback?code=abc');
    const res = await agent.get('/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ email: ALLOWED_A });
  });

  it('returns 401 when the cookie email is no longer in the allowlist', async () => {
    const app = buildApp();
    const agent = request.agent(app);
    mockPayload(ALLOWED_A, true);
    await agent.get('/auth/google/callback?code=abc');
    process.env.ALLOWED_EMAILS = ALLOWED_B;
    const res = await agent.get('/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('requireAuth', () => {
  it('bypasses auth entirely when GOOGLE_CLIENT_ID is unset', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const res = await request(buildApp()).get('/api/protected');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns 401 json on an /api path with no valid cookie', async () => {
    delete process.env.ALLOWED_EMAILS;
    const res = await request(buildApp()).get('/api/protected');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'unauthorized' });
  });

  it('redirects to /auth/google on a non-/api path with no valid cookie', async () => {
    const res = await request(buildApp()).get('/protected-page');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/auth/google');
  });

  it('calls next() for an /api path with a valid allowlisted cookie', async () => {
    const app = buildApp();
    const agent = request.agent(app);
    mockPayload(ALLOWED_B, true);
    await agent.get('/auth/google/callback?code=abc');
    const res = await agent.get('/api/protected');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
