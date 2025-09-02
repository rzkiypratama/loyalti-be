CREATE EXTENSION IF NOT EXISTS citext;

-- customers & wallets
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  email CITEXT UNIQUE NOT NULL,
  shop_customer_id BIGINT,
  name TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS point_wallets (
  customer_id INT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  balance INT NOT NULL DEFAULT 0,
  lifetime_points INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS point_transactions (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
  delta INT NOT NULL,                  -- +earn / -redeem / -rollback
  reason TEXT,
  meta JSONB,
  created_at TIMESTAMP DEFAULT now()
);

-- tiers
CREATE TABLE IF NOT EXISTS tiers (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT,
  min_lifetime_spend_cents BIGINT,
  multiplier NUMERIC(6,3) DEFAULT 1.0,
  perks JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS customer_tiers (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
  tier_id INT REFERENCES tiers(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP DEFAULT now()
);

-- redemptions (kode diskon)
CREATE TABLE IF NOT EXISTS redemptions (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
  points_spent INT NOT NULL,
  discount_code TEXT NOT NULL,
  discount_value_cents INT NOT NULL,
  status TEXT DEFAULT 'active',        -- active/used/cancelled/expired
  created_at TIMESTAMP DEFAULT now()
);

-- earn rules (konfigurasi rate)
CREATE TABLE IF NOT EXISTS earn_rules (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,                  -- 'per_currency_spent', 'signup_bonus', dll
  value NUMERIC(12,4) NOT NULL,        -- mis. 100 pts per 100000 cents -> simpan 100000.0000 sebagai divider atau simpan mapping lain
  meta JSONB DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT TRUE
);