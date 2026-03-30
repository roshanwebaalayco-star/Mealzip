import { describe, it, expect, beforeAll } from 'vitest';

const API = 'http://localhost:3000';
let authToken = '';

async function api(method: string, path: string, body?: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${API}${path}`, opts);
}

async function apiNoAuth(method: string, path: string, body?: any) {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${API}${path}`, opts);
}

beforeAll(async () => {
  const loginRes = await fetch(`${API}/api/demo/quick-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (loginRes.ok) {
    const data = await loginRes.json();
    authToken = data.token || '';
  }
});

describe('Health Check Endpoints', () => {
  it('GET /api/healthz returns ok', async () => {
    const res = await apiNoAuth('GET', '/api/healthz');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.database).toBe('connected');
  });

  it('healthz includes recipe count', async () => {
    const res = await apiNoAuth('GET', '/api/healthz');
    const data = await res.json();
    expect(data.recipes).toBeGreaterThan(0);
  });

  it('healthz includes knowledge chunks', async () => {
    const res = await apiNoAuth('GET', '/api/healthz');
    const data = await res.json();
    expect(data.knowledgeChunks).toBeGreaterThanOrEqual(0);
  });

  it('healthz includes embedding queue status', async () => {
    const res = await apiNoAuth('GET', '/api/healthz');
    const data = await res.json();
    expect(data.embeddingQueue).toBeDefined();
  });
});

describe('Auth Endpoints', () => {
  it('GET /api/auth/me returns 401 when not logged in', async () => {
    const res = await apiNoAuth('GET', '/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login with invalid creds returns error', async () => {
    const res = await apiNoAuth('POST', '/api/auth/login', { email: 'noone@invalid.com', password: 'wrong' });
    expect([400, 401, 404]).toContain(res.status);
  });

  it('POST /api/demo/quick-login returns a token', async () => {
    const res = await apiNoAuth('POST', '/api/demo/quick-login', {});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBeDefined();
  });
});

describe('Family Endpoints — Auth Protection', () => {
  it('POST /api/families without auth returns 401', async () => {
    const res = await apiNoAuth('POST', '/api/families', { name: 'Test', state: 'Bihar' });
    expect(res.status).toBe(401);
  });

  it('GET /api/families without auth returns 401', async () => {
    const res = await apiNoAuth('GET', '/api/families');
    expect(res.status).toBe(401);
  });

  it('GET /api/families with auth returns 200', async () => {
    if (!authToken) return;
    const res = await api('GET', '/api/families');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe('Recipe Endpoints (authenticated)', () => {
  it('GET /api/recipes returns results', async () => {
    if (!authToken) return;
    const res = await api('GET', '/api/recipes');
    expect(res.status).toBe(200);
    const data = await res.json();
    const recipes = data.recipes ?? data;
    expect(Array.isArray(recipes)).toBe(true);
    expect(recipes.length).toBeGreaterThan(0);
  });

  it('GET /api/recipes filters by diet', async () => {
    if (!authToken) return;
    const res = await api('GET', '/api/recipes?diet=Vegetarian');
    expect(res.status).toBe(200);
    const data = await res.json();
    const recipes = data.recipes ?? data;
    expect(Array.isArray(recipes)).toBe(true);
  });

  it('GET /api/recipes search works', async () => {
    if (!authToken) return;
    const res = await api('GET', '/api/recipes?search=dal');
    expect(res.status).toBe(200);
  });

  it('GET /api/recipes/:id returns a recipe', async () => {
    if (!authToken) return;
    const listRes = await api('GET', '/api/recipes?limit=1');
    const listData = await listRes.json();
    const list = listData.recipes ?? listData;
    if (list.length > 0) {
      const id = list[0].id;
      const res = await api('GET', `/api/recipes/${id}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(id);
    }
  });

  it('GET /api/recipes/:id 404 for non-existent', async () => {
    if (!authToken) return;
    const res = await api('GET', '/api/recipes/99999999');
    expect(res.status).toBe(404);
  });
});

describe('Authentication Security', () => {
  const protectedRoutes: [string, string][] = [
    ['GET', '/api/families'],
    ['POST', '/api/families'],
    ['GET', '/api/meal-plans'],
    ['POST', '/api/meal-plans/generate'],
    ['GET', '/api/gemini/conversations'],
    ['POST', '/api/gemini/conversations'],
    ['GET', '/api/recipes'],
  ];

  protectedRoutes.forEach(([method, route]) => {
    it(`${method} ${route} returns 401 without auth`, async () => {
      const res = await apiNoAuth(method, route, method === 'POST' ? {} : undefined);
      expect(res.status).toBe(401);
    });
  });

  it('SQL injection in search returns 200 or 400 and tables intact', async () => {
    if (!authToken) return;
    const res = await api('GET', `/api/recipes?search=${encodeURIComponent("'; DROP TABLE recipes; --")}`);
    expect([200, 400]).toContain(res.status);
    const verifyRes = await api('GET', '/api/recipes?limit=1');
    expect(verifyRes.status).toBe(200);
    const verifyData = await verifyRes.json();
    const recipes = verifyData.recipes ?? verifyData;
    expect(Array.isArray(recipes)).toBe(true);
    expect(recipes.length).toBeGreaterThan(0);
  });

  it('XSS in recipe search is sanitised', async () => {
    if (!authToken) return;
    const res = await api('GET', `/api/recipes?search=${encodeURIComponent('<script>alert("xss")</script>')}`);
    const responseText = JSON.stringify(await res.json());
    expect(responseText.includes('<script>')).toBe(false);
  });
});
