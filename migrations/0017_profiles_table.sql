-- Create app-managed profiles table
CREATE TABLE IF NOT EXISTS profiles (
  user_id varchar PRIMARY KEY,
  display_name text,
  avatar_url text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);

