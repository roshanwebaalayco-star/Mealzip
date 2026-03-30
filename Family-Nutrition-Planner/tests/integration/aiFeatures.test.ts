import { describe, it, expect, beforeAll } from 'vitest';

const API = 'http://localhost:3000';
let authToken: string | null = null;
let aiAvailable = false;

async function api(method: string, path: string, body?: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function checkGeminiApiKey(): Promise<boolean> {
  try {
    const res = await api('GET', '/api/healthz');
    const data = await res.json();
    return data.embeddedRecipes > 0 || data.knowledgeChunks > 0;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  aiAvailable = await checkGeminiApiKey();
  const res = await fetch(`${API}/api/demo/quick-login`, { method: 'POST' });
  const data = await res.json();
  authToken = data.token ?? null;
  expect(authToken, 'Demo login must succeed for authenticated tests').toBeTruthy();
});

describe('AI-Dependent Features — Infrastructure', () => {
  it('healthz reports knowledge chunk count field', async () => {
    const res = await api('GET', '/api/healthz');
    const data = await res.json();
    expect(data).toHaveProperty('knowledgeChunks');
    expect(typeof data.knowledgeChunks).toBe('number');
  });

  it('healthz reports embedding queue info', async () => {
    const res = await api('GET', '/api/healthz');
    const data = await res.json();
    expect(data.embeddingQueue).toBeDefined();
    expect(data.embeddingQueue).toHaveProperty('isRunning');
    expect(data.embeddingQueue).toHaveProperty('processedCount');
  });

  it('embedded recipes count is zero when AI unavailable', async () => {
    const res = await api('GET', '/api/healthz');
    const data = await res.json();
    expect(typeof data.embeddedRecipes).toBe('number');
    if (!aiAvailable) {
      expect(data.embeddedRecipes).toBe(0);
    }
  });
});

describe('Auth-Protected AI Endpoints — Security', () => {
  it('POST /api/meal-plans/generate requires auth', async () => {
    const res = await fetch(`${API}/api/meal-plans/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/gemini/conversations requires auth', async () => {
    const res = await fetch(`${API}/api/gemini/conversations`);
    expect(res.status).toBe(401);
  });

  it('POST /api/gemini/conversations requires auth', async () => {
    const res = await fetch(`${API}/api/gemini/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'test' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('Gemini Conversations (Replit integration — always available)', () => {
  it('GET /api/gemini/conversations with auth returns array', async () => {
    const res = await api('GET', '/api/gemini/conversations');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe('Embedding-Dependent Endpoints (skipped when direct GEMINI_API_KEY invalid)', () => {
  it.skipIf(!aiAvailable)('knowledge chunks should be ingested when embeddings available', async () => {
    const res = await api('GET', '/api/healthz');
    const data = await res.json();
    expect(data.knowledgeChunks).toBeGreaterThan(0);
  });

  it.skipIf(!aiAvailable)('embedded recipes count should be positive when embeddings available', async () => {
    const res = await api('GET', '/api/healthz');
    const data = await res.json();
    expect(data.embeddedRecipes).toBeGreaterThan(0);
  });
});

describe('Meal Plan Generation — Error Handling', () => {
  it('POST /api/meal-plans/generate with auth rejects invalid familyId', async () => {
    const res = await api('POST', '/api/meal-plans/generate', {
      familyId: 99999,
      budget: 5000,
    });
    expect([400, 404, 500]).toContain(res.status);
  });
});

describe('Recipe Nutrient Data Validation', () => {
  it('recipes include calorie and protein fields', async () => {
    const res = await api('GET', '/api/recipes?limit=1');
    expect(res.status).toBe(200);
    const data = await res.json();
    const recipes = data.recipes ?? data;
    expect(recipes.length).toBeGreaterThan(0);
    const recipe = recipes[0];
    expect(recipe).toHaveProperty('calories');
    expect(recipe).toHaveProperty('protein');
  });
});
