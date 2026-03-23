BEGIN;

INSERT INTO transaction.checkout_sessions (
  request_id,
  customer_email,
  customer_first_name,
  customer_last_name,
  customer_phone,
  shipping_address1,
  shipping_address2,
  shipping_city,
  shipping_province,
  shipping_country,
  shipping_zip,
  cart_items,
  checkout_url
)
VALUES
(
  'seed-checkout-001',
  'buyer.one@example.com',
  'Aarav',
  'Sharma',
  '+919876543210',
  '221B MG Road',
  'Near Central Mall',
  'Bengaluru',
  'Karnataka',
  'India',
  '560001',
  '[{"variantId":"1001","quantity":2},{"variantId":"1002","quantity":1}]'::jsonb,
  'https://your-store.myshopify.com/cart/1001:2,1002:1?checkout&checkout%5Bemail%5D=buyer.one%40example.com&checkout%5Bshipping_address%5D%5Bfirst_name%5D=Aarav&checkout%5Bshipping_address%5D%5Blast_name%5D=Sharma&checkout%5Bshipping_address%5D%5Baddress1%5D=221B%20MG%20Road&checkout%5Bshipping_address%5D%5Baddress2%5D=Near%20Central%20Mall&checkout%5Bshipping_address%5D%5Bcity%5D=Bengaluru&checkout%5Bshipping_address%5D%5Bprovince%5D=Karnataka&checkout%5Bshipping_address%5D%5Bcountry%5D=India&checkout%5Bshipping_address%5D%5Bzip%5D=560001'
),
(
  'seed-checkout-002',
  'buyer.two@example.com',
  'Priya',
  'Nair',
  '+919812345678',
  '14 Park Street',
  NULL,
  'Kochi',
  'Kerala',
  'India',
  '682011',
  '[{"variantId":"1003","quantity":1}]'::jsonb,
  'https://your-store.myshopify.com/cart/1003:1?checkout&checkout%5Bemail%5D=buyer.two%40example.com&checkout%5Bshipping_address%5D%5Bfirst_name%5D=Priya&checkout%5Bshipping_address%5D%5Blast_name%5D=Nair&checkout%5Bshipping_address%5D%5Baddress1%5D=14%20Park%20Street&checkout%5Bshipping_address%5D%5Bcity%5D=Kochi&checkout%5Bshipping_address%5D%5Bprovince%5D=Kerala&checkout%5Bshipping_address%5D%5Bcountry%5D=India&checkout%5Bshipping_address%5D%5Bzip%5D=682011'
),
(
  'seed-checkout-003',
  'buyer.three@example.com',
  'Rahul',
  'Verma',
  '+919900112233',
  '8 River View Apartments',
  'Flat 12C',
  'Pune',
  'Maharashtra',
  'India',
  '411001',
  '[{"variantId":"1004","quantity":3}]'::jsonb,
  'https://your-store.myshopify.com/cart/1004:3?checkout&checkout%5Bemail%5D=buyer.three%40example.com&checkout%5Bshipping_address%5D%5Bfirst_name%5D=Rahul&checkout%5Bshipping_address%5D%5Blast_name%5D=Verma&checkout%5Bshipping_address%5D%5Baddress1%5D=8%20River%20View%20Apartments&checkout%5Bshipping_address%5D%5Baddress2%5D=Flat%2012C&checkout%5Bshipping_address%5D%5Bcity%5D=Pune&checkout%5Bshipping_address%5D%5Bprovince%5D=Maharashtra&checkout%5Bshipping_address%5D%5Bcountry%5D=India&checkout%5Bshipping_address%5D%5Bzip%5D=411001'
);

COMMIT;
