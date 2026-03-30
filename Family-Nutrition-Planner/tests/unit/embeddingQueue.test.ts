import { describe, it, expect } from 'vitest';

const API = 'http://localhost:3000';

describe('Embedding Queue', () => {
  it('queue status is available via healthz', async () => {
    const res = await fetch(`${API}/api/healthz`);
    const data = await res.json();
    expect(data.embeddingQueue).toBeDefined();
    expect(data.embeddingQueue).toHaveProperty('isRunning');
    expect(data.embeddingQueue).toHaveProperty('processedCount');
    expect(data.embeddingQueue).toHaveProperty('totalToProcess');
  });

  it('recipes count is available', async () => {
    const res = await fetch(`${API}/api/healthz`);
    const data = await res.json();
    expect(data.recipes).toBeGreaterThan(12000);
  });

  it('embedded recipes count is a valid number', async () => {
    const res = await fetch(`${API}/api/healthz`);
    const data = await res.json();
    expect(typeof data.embeddedRecipes).toBe('number');
    expect(data.embeddedRecipes).toBeGreaterThanOrEqual(0);
  });
});
