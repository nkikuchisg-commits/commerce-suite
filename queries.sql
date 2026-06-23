-- =====================================================================
-- ダッシュボードを支えるSQL（MySQL）
-- このサイトの管理画面が「もしMySQLで動いていたら」実行するクエリ集です。
-- ブラウザ版デモはJavaScriptで同じ集計をしています。SQL学習用にどうぞ。
-- 期間は「直近30日」を例にしています（CURDATE() - INTERVAL 30 DAY）。
-- 売上の集計はキャンセルと返品を除外（status NOT IN ('canceled','returned')）しています。
-- （返品＝返金済みとして売上から除外。ただし返品は再販しない想定のため在庫は戻さない）
-- =====================================================================

-- 1) KPI：期間の売上高・注文数・平均注文額 ----------------------------
SELECT
  SUM(total)                         AS sales,        -- 売上高
  COUNT(*)                           AS order_count,  -- 注文数
  ROUND(AVG(total))                  AS avg_order      -- 平均注文額
FROM orders
WHERE status NOT IN ('canceled', 'returned')
  AND ordered_at >= CURDATE() - INTERVAL 30 DAY;

-- 2) KPI：未発送（要対応）の件数 --------------------------------------
SELECT COUNT(*) AS pending
FROM orders
WHERE status = 'new';

-- 3) 売上推移（折れ線グラフ用：日別の売上） --------------------------
SELECT
  DATE(ordered_at)  AS day,
  SUM(total)        AS sales
FROM orders
WHERE status NOT IN ('canceled', 'returned')
  AND ordered_at >= CURDATE() - INTERVAL 30 DAY
GROUP BY DATE(ordered_at)
ORDER BY day;

-- 4) カテゴリ構成比（ドーナツグラフ用） ------------------------------
--   注文明細→商品 を結合してカテゴリ別に売上を合計
SELECT
  p.category,
  SUM(oi.unit_price * oi.quantity) AS sales
FROM order_items oi
JOIN orders   o ON o.id = oi.order_id
JOIN products p ON p.id = oi.product_id
WHERE o.status NOT IN ('canceled', 'returned')
  AND o.ordered_at >= CURDATE() - INTERVAL 30 DAY
GROUP BY p.category
ORDER BY sales DESC;

-- 5) 人気商品 TOP5（棒グラフ用：販売数量の多い順） ------------------
SELECT
  p.name,
  SUM(oi.quantity) AS qty
FROM order_items oi
JOIN orders   o ON o.id = oi.order_id
JOIN products p ON p.id = oi.product_id
WHERE o.status NOT IN ('canceled', 'returned')
  AND o.ordered_at >= CURDATE() - INTERVAL 30 DAY
GROUP BY p.id, p.name
ORDER BY qty DESC
LIMIT 5;

-- 6) 最近の注文（ダッシュボード右下） --------------------------------
SELECT id, customer_name, total, status, ordered_at
FROM orders
ORDER BY ordered_at DESC
LIMIT 6;

-- 7) 注文管理：状態でしぼり込み（例：未発送のみ） --------------------
SELECT id, ordered_at, customer_name, total, status
FROM orders
WHERE status = 'new'          -- 'shipped' / 'done' / 'canceled' に変えて使う
ORDER BY ordered_at DESC;

-- 8) 注文の状態を更新（管理画面のプルダウン操作に相当） --------------
UPDATE orders SET status = 'shipped' WHERE id = 'ORD-SAMPLE-5003';

-- 9) 在庫アラート：在庫切れ・残りわずか ------------------------------
SELECT id, name, stock,
       CASE WHEN stock <= 0 THEN '在庫切れ'
            WHEN stock <= 5 THEN '残りわずか'
            ELSE '十分' END AS stock_status
FROM products
WHERE stock <= 5
ORDER BY stock ASC;

-- 10) 商品別の累計販売数（商品・在庫ページ） -------------------------
SELECT
  p.id, p.name, p.stock,
  COALESCE(SUM(CASE WHEN o.status NOT IN ('canceled', 'returned') THEN oi.quantity END), 0) AS total_sold
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders      o  ON o.id = oi.order_id
GROUP BY p.id, p.name, p.stock
ORDER BY total_sold DESC;

-- 11) 注文時に在庫を減らす（トランザクションの例） -------------------
--   実際の注文確定では「注文を作る」「在庫を減らす」を1セットで行う。
START TRANSACTION;
  INSERT INTO orders (id, customer_name, ordered_at, subtotal, shipping_fee, total, status)
  VALUES ('ORD-EXAMPLE-9001', '山田 太郎', NOW(), 1280, 550, 1830, 'new');
  INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
  VALUES ('ORD-EXAMPLE-9001', 'cf01', 'ドリップコーヒー 10袋', 1280, 1);
  UPDATE products SET stock = stock - 1 WHERE id = 'cf01' AND stock >= 1;
COMMIT;
