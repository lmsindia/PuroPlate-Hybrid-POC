BEGIN;

CREATE TABLE IF NOT EXISTS transaction.checkout_sessions (
  id BIGSERIAL PRIMARY KEY,
  shopify_cart_id TEXT,
  checkout_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transaction.checkout_sessions
  ADD COLUMN IF NOT EXISTS request_id TEXT;

ALTER TABLE transaction.checkout_sessions
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

ALTER TABLE transaction.checkout_sessions
  ADD COLUMN IF NOT EXISTS customer_first_name TEXT;

ALTER TABLE transaction.checkout_sessions
  ADD COLUMN IF NOT EXISTS customer_last_name TEXT;

ALTER TABLE transaction.checkout_sessions
  ADD COLUMN IF NOT EXISTS customer_phone TEXT;

ALTER TABLE transaction.checkout_sessions
  ADD COLUMN IF NOT EXISTS shipping_address1 TEXT;

ALTER TABLE transaction.checkout_sessions
  ADD COLUMN IF NOT EXISTS shipping_address2 TEXT;

ALTER TABLE transaction.checkout_sessions
  ADD COLUMN IF NOT EXISTS shipping_city TEXT;

ALTER TABLE transaction.checkout_sessions
  ADD COLUMN IF NOT EXISTS shipping_province TEXT;

ALTER TABLE transaction.checkout_sessions
  ADD COLUMN IF NOT EXISTS shipping_country TEXT;

ALTER TABLE transaction.checkout_sessions
  ADD COLUMN IF NOT EXISTS shipping_zip TEXT;

ALTER TABLE transaction.checkout_sessions
  ADD COLUMN IF NOT EXISTS cart_items JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS checkout_sessions_created_at_idx
  ON transaction.checkout_sessions (created_at DESC);

CREATE INDEX IF NOT EXISTS checkout_sessions_customer_email_idx
  ON transaction.checkout_sessions (customer_email);

COMMIT;
