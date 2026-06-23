-- =====================================================================
-- こもれび商店 データベース設計（MySQL 8.0 想定）
-- このサイトの「動くデモ」はブラウザ内（localStorage）で動作しますが、
-- データ構造は本ファイルのMySQL設計と同じ考え方です。
-- 実行例: mysql -u root -p < schema.sql
-- =====================================================================
SET NAMES utf8mb4;

DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS products;

-- 商品（在庫つき）
CREATE TABLE products (
  id           VARCHAR(16)   NOT NULL,                 -- 商品コード（例: cf01）
  name         VARCHAR(100)  NOT NULL,
  category     VARCHAR(40)   NOT NULL,
  price        INT UNSIGNED  NOT NULL,                 -- 税込価格（円）
  stock        INT           NOT NULL DEFAULT 0,       -- 在庫数
  emoji        VARCHAR(8)        NULL,                 -- 表示用（デモ）
  description  VARCHAR(255)      NULL,
  is_active    TINYINT(1)    NOT NULL DEFAULT 1,       -- 公開/非公開
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_products_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 顧客
CREATE TABLE customers (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name         VARCHAR(60)   NOT NULL,
  email        VARCHAR(120)      NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 注文（ヘッダ）
CREATE TABLE orders (
  id            VARCHAR(24)  NOT NULL,                 -- 注文番号（例: ORD-20260623-5001）
  customer_id   INT UNSIGNED     NULL,
  customer_name VARCHAR(60)  NOT NULL,                 -- 表示用の控え
  ordered_at    DATETIME     NOT NULL,
  subtotal      INT UNSIGNED NOT NULL,
  shipping_fee  INT UNSIGNED NOT NULL DEFAULT 0,
  total         INT UNSIGNED NOT NULL,
  status        ENUM('new','shipped','done','returned','canceled') NOT NULL DEFAULT 'new',
  channel       VARCHAR(20)  NOT NULL DEFAULT 'store',
  PRIMARY KEY (id),
  KEY idx_orders_ordered_at (ordered_at),
  KEY idx_orders_status (status),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 注文明細（1注文に複数商品）
CREATE TABLE order_items (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id      VARCHAR(24)  NOT NULL,
  product_id    VARCHAR(16)  NOT NULL,
  product_name  VARCHAR(100) NOT NULL,                 -- 注文時点の商品名（履歴として保持）
  unit_price    INT UNSIGNED NOT NULL,                 -- 注文時点の単価
  quantity      INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY idx_items_order (order_id),
  KEY idx_items_product (product_id),
  CONSTRAINT fk_items_order   FOREIGN KEY (order_id)   REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ポイント解説（学習メモ）
--  ・PRIMARY KEY … 各行を一意に識別するキー
--  ・FOREIGN KEY … 注文明細→注文→顧客 のように表どうしを関連づける（リレーショナル）
--  ・KEY(index) … 日付や状態での検索・集計を速くするための索引
--  ・order_items に product_name / unit_price を持つ … 後で商品名や価格が変わっても
--    「注文した当時の内容」を正しく残すため（実務でよく使う設計）
