ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id uuid;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_unique ON users(auth_user_id) WHERE auth_user_id IS NOT NULL;

DO $$
BEGIN
  UPDATE users u
  SET auth_user_id = au.id
  FROM auth.users au
  WHERE u.auth_user_id IS NULL
    AND au.email IS NOT NULL
    AND lower(au.email) = lower(u.email);
EXCEPTION
  WHEN undefined_table THEN
    -- Non-Supabase environments do not expose auth.users.
    NULL;
END $$;
