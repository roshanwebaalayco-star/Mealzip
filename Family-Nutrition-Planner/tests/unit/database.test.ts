import { describe, it, expect, afterAll } from 'vitest';
import { pool } from '@workspace/db';

describe('Database Connection', () => {
  it('connects successfully', async () => {
    const result = await pool.query('SELECT 1 as val');
    expect(result.rows[0].val).toBe(1);
  });

  it('pgvector extension is enabled', async () => {
    const result = await pool.query(
      "SELECT extname FROM pg_extension WHERE extname = 'vector'"
    );
    expect(result.rows.length).toBe(1);
  });

  it('all required tables exist', async () => {
    const tables = [
      'users', 'families', 'family_members',
      'recipes', 'meal_plans', 'meal_feedback',
      'nutrition_logs', 'grocery_lists',
      'health_logs', 'conversations', 'messages',
      'knowledge_chunks', 'icmr_nin_rda', 'leftover_items',
      'pantry_items', 'food_gi_nutrition'
    ];
    for (const table of tables) {
      const result = await pool.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1) as "exists"`,
        [table]
      );
      expect(result.rows[0].exists, `Table ${table} must exist`).toBe(true);
    }
  });

  it('recipes table has embedding column', async () => {
    const result = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'recipes' AND column_name = 'embedding'`
    );
    expect(result.rows.length).toBe(1);
  });

  it('knowledge_chunks table has embedding column', async () => {
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding'`
    );
    expect(result.rows.length).toBe(1);
  });

  it('recipes table has data', async () => {
    const result = await pool.query('SELECT COUNT(*) as count FROM recipes');
    const count = parseInt(result.rows[0].count);
    expect(count).toBeGreaterThan(100);
  });

  it('knowledge_chunks table exists and is queryable', async () => {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM knowledge_chunks`
    );
    expect(parseInt(result.rows[0].count)).toBeGreaterThanOrEqual(0);
  });

  it('icmr_nin_rda table has data', async () => {
    const result = await pool.query('SELECT COUNT(*) as count FROM icmr_nin_rda');
    expect(parseInt(result.rows[0].count)).toBeGreaterThan(0);
  });

  it('can insert and retrieve a test family', async () => {
    const result = await pool.query(
      `INSERT INTO families (name, state, monthly_budget, user_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      ['DB Test Family', 'Rajasthan', 8000, 1]
    );
    expect(result.rows[0].id).toBeDefined();
    expect(result.rows[0].name).toBe('DB Test Family');
    await pool.query('DELETE FROM families WHERE id = $1', [result.rows[0].id]);
  });

  it('can insert and retrieve a family member', async () => {
    const famResult = await pool.query(
      `INSERT INTO families (name, state, monthly_budget, user_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Member Test Family', 'Bihar', 5000, 1]
    );
    const familyId = famResult.rows[0].id;

    const memResult = await pool.query(
      `INSERT INTO family_members (family_id, name, age, gender, activity_level, role)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [familyId, 'Test Member', 35, 'male', 'sedentary', 'father']
    );
    expect(memResult.rows[0].id).toBeDefined();
    expect(memResult.rows[0].name).toBe('Test Member');

    await pool.query('DELETE FROM family_members WHERE id = $1', [memResult.rows[0].id]);
    await pool.query('DELETE FROM families WHERE id = $1', [familyId]);
  });

  it('foreign key constraint enforced', async () => {
    await expect(
      pool.query(
        `INSERT INTO family_members (family_id, name, age, gender) VALUES ($1, $2, $3, $4)`,
        [99999999, 'Ghost', 30, 'male']
      )
    ).rejects.toThrow();
  });

  it('embedding vector dimension check', async () => {
    const result = await pool.query(
      `SELECT embedding FROM knowledge_chunks WHERE embedding IS NOT NULL LIMIT 1`
    );
    if (result.rows.length > 0) {
      const embedding = result.rows[0].embedding;
      const values = embedding.replace('[', '').replace(']', '').split(',');
      expect(values.length).toBe(1024);
    }
  });

  afterAll(async () => {
    await pool.end();
  });
});
