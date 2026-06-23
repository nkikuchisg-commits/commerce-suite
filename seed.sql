-- =====================================================================
-- こもれび商店 サンプルデータ（MySQL）
-- schema.sql を実行した後に流し込んでください。
-- 実行例: mysql -u root -p komorebi < seed.sql
-- ※ 日付は実行時点を基準に「○日前」で入れているので、
--    集計クエリ（queries.sql）がいつ実行しても結果が出ます。
-- =====================================================================
SET NAMES utf8mb4;

-- 商品（在庫つき・ブラウザ版デモと同じ12点）
INSERT INTO products (id, name, category, price, stock, emoji, description) VALUES
('cf01','ドリップコーヒー 10袋','コーヒー',1280,64,'☕','自家焙煎の中深煎り。'),
('cf02','コーヒー豆 200g','コーヒー',1680,38,'🫘','華やかな香りのエチオピア産。'),
('ki01','波佐見焼マグカップ','キッチン',2200,27,'🍵','手になじむ厚手のマグ。'),
('ki02','ステンレスケトル','キッチン',4800,9,'🫖','注ぎやすい細口。'),
('ki03','オリーブオイル 250ml','食品',1980,52,'🫒','コールドプレス。'),
('zk01','リネントートバッグ','雑貨',2980,18,'👜','丈夫な厚手リネン。'),
('zk02','アロマキャンドル','雑貨',1650,4,'🕯️','ウッディな香り。'),
('zk03','リングノート 2冊組','雑貨',980,73,'📒','方眼ノート。'),
('fa01','コットンソックス 3足','ファッション',1480,41,'🧦','オーガニックコットン。'),
('fa02','ウールマフラー','ファッション',5200,0,'🧣','上質ウール100%。'),
('bd01','ハンドソープ','ボディケア',1180,35,'🧼','植物由来。'),
('bd02','ハンドクリーム','ボディケア',1380,22,'🧴','しっとり保湿。');

-- 顧客
INSERT INTO customers (id, name, email) VALUES
(1,'佐藤 結衣','yui.sato@example.com'),
(2,'鈴木 大翔','hiroto.suzuki@example.com'),
(3,'高橋 葵','aoi.takahashi@example.com');

-- 注文（ヘッダ）＋ 明細
-- 注文1（5日前・完了）
INSERT INTO orders (id, customer_id, customer_name, ordered_at, subtotal, shipping_fee, total, status) VALUES
('ORD-SAMPLE-5001', 1, '佐藤 結衣', NOW() - INTERVAL 5 DAY, 5160, 0, 5160, 'done');
INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity) VALUES
('ORD-SAMPLE-5001','cf01','ドリップコーヒー 10袋',1280,2),
('ORD-SAMPLE-5001','ki01','波佐見焼マグカップ',2200,1),
('ORD-SAMPLE-5001','zk03','リングノート 2冊組',980,1);

-- 注文2（3日前・発送済み）
INSERT INTO orders (id, customer_id, customer_name, ordered_at, subtotal, shipping_fee, total, status) VALUES
('ORD-SAMPLE-5002', 2, '鈴木 大翔', NOW() - INTERVAL 3 DAY, 4800, 550, 5350, 'shipped');
INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity) VALUES
('ORD-SAMPLE-5002','ki02','ステンレスケトル',4800,1);

-- 注文3（1日前・未発送）
INSERT INTO orders (id, customer_id, customer_name, ordered_at, subtotal, shipping_fee, total, status) VALUES
('ORD-SAMPLE-5003', 3, '高橋 葵', NOW() - INTERVAL 1 DAY, 6160, 0, 6160, 'new');
INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity) VALUES
('ORD-SAMPLE-5003','fa01','コットンソックス 3足',1480,2),
('ORD-SAMPLE-5003','bd02','ハンドクリーム',1380,1),
('ORD-SAMPLE-5003','ki03','オリーブオイル 250ml',1980,1),
('ORD-SAMPLE-5003','zk02','アロマキャンドル',1650,1);

-- 注文4（本日・未発送）
INSERT INTO orders (id, customer_id, customer_name, ordered_at, subtotal, shipping_fee, total, status) VALUES
('ORD-SAMPLE-5004', 1, '佐藤 結衣', NOW(), 3840, 550, 4390, 'new');
INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity) VALUES
('ORD-SAMPLE-5004','cf02','コーヒー豆 200g',1680,1),
('ORD-SAMPLE-5004','bd01','ハンドソープ',1180,1),
('ORD-SAMPLE-5004','zk03','リングノート 2冊組',980,1);

-- 注文5（10日前・完了）
INSERT INTO orders (id, customer_id, customer_name, ordered_at, subtotal, shipping_fee, total, status) VALUES
('ORD-SAMPLE-5005', 2, '鈴木 大翔', NOW() - INTERVAL 10 DAY, 5200, 0, 5200, 'done');
INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity) VALUES
('ORD-SAMPLE-5005','fa02','ウールマフラー',5200,1);
