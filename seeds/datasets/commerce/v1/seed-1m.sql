INSERT INTO users (email, name, status)
SELECT
  'user' || gs || '@example.com',
  'User ' || gs,
  CASE (gs % 4)
    WHEN 0 THEN 'active'
    WHEN 1 THEN 'inactive'
    WHEN 2 THEN 'suspended'
    ELSE 'pending'
  END
FROM generate_series(1, 100000) AS gs;

INSERT INTO products (sku, name, price)
SELECT 'SKU-' || gs, 'Product ' || gs, ((gs % 1000) + 9.99)::numeric(10, 2)
FROM generate_series(1, 50000) AS gs;

INSERT INTO orders (user_id, product_id, quantity, status)
SELECT
  ((gs - 1) % 100000) + 1,
  ((gs - 1) % 50000) + 1,
  (gs % 5) + 1,
  CASE WHEN gs % 10 = 0 THEN 'cancelled' ELSE 'completed' END
FROM generate_series(1, 500000) AS gs;

INSERT INTO payments (order_id, amount, status)
SELECT gs, 49.99, 'paid'
FROM generate_series(1, 500000) AS gs;

INSERT INTO logs (user_id, event_type, payload)
SELECT
  ((gs - 1) % 100000) + 1,
  'page_view',
  '{"page": "/products"}'::jsonb
FROM generate_series(1, 1000000) AS gs;
