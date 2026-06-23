"use strict";

/* =========================================================================
 * 共有データベース層（store と admin が同じデータを参照）
 * - 商品（在庫つき）と注文を localStorage に保存
 * - 初回はシードで過去120日分の注文と在庫を自動生成
 * - 店舗での注文 → 在庫が減り、注文として記録 → 管理画面の集計に反映
 * =======================================================================*/
const DB = (() => {
  const KEY = "komorebi.db.v1";

  const SEED_PRODUCTS = [
    { id: "cf01", name: "ドリップコーヒー 10袋", cat: "コーヒー", price: 1280, emoji: "☕", bg: "#efe1d2", stock: 64, desc: "自家焙煎の中深煎り。毎朝の一杯に。" },
    { id: "cf02", name: "コーヒー豆 200g", cat: "コーヒー", price: 1680, emoji: "🫘", bg: "#e7d6c4", stock: 38, desc: "華やかな香りのエチオピア産。" },
    { id: "ki01", name: "波佐見焼マグカップ", cat: "キッチン", price: 2200, emoji: "🍵", bg: "#dde7e3", stock: 27, desc: "手になじむ、ぽってり厚手のマグ。" },
    { id: "ki02", name: "ステンレスケトル", cat: "キッチン", price: 4800, emoji: "🫖", bg: "#e3e6ea", stock: 9, desc: "注ぎやすい細口。コーヒーに最適。" },
    { id: "ki03", name: "オリーブオイル 250ml", cat: "食品", price: 1980, emoji: "🫒", bg: "#dfe6d4", stock: 52, desc: "エキストラバージン・コールドプレス。" },
    { id: "zk01", name: "リネントートバッグ", cat: "雑貨", price: 2980, emoji: "👜", bg: "#e9e2d6", stock: 18, desc: "丈夫な厚手リネン。普段使いに。" },
    { id: "zk02", name: "アロマキャンドル", cat: "雑貨", price: 1650, emoji: "🕯️", bg: "#efe4d8", stock: 4, desc: "ウッディな香りでくつろぐ夜に。" },
    { id: "zk03", name: "リングノート 2冊組", cat: "雑貨", price: 980, emoji: "📒", bg: "#e6e0d2", stock: 73, desc: "なめらかな書き心地の方眼ノート。" },
    { id: "fa01", name: "コットンソックス 3足", cat: "ファッション", price: 1480, emoji: "🧦", bg: "#e4e1ea", stock: 41, desc: "肌ざわりのよいオーガニックコットン。" },
    { id: "fa02", name: "ウールマフラー", cat: "ファッション", price: 5200, emoji: "🧣", bg: "#e6dde0", stock: 0, desc: "やわらかく軽い、上質ウール100%。" },
    { id: "bd01", name: "ハンドソープ", cat: "ボディケア", price: 1180, emoji: "🧼", bg: "#dfe7ea", stock: 35, desc: "植物由来でやさしい洗い心地。" },
    { id: "bd02", name: "ハンドクリーム", cat: "ボディケア", price: 1380, emoji: "🧴", bg: "#e8e1e6", stock: 22, desc: "しっとり保湿、べたつかない使い心地。" },
  ];
  const SURNAMES = ["佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村", "小林", "加藤", "吉田", "山田", "松本", "井上", "木村", "林", "清水", "森", "池田", "橋本"];
  const GIVEN = ["陽菜", "蓮", "葵", "結衣", "大翔", "凛", "悠真", "莉子", "湊", "結菜", "颯太", "芽依", "樹", "美桜"];

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

  function seed() {
    const r = rng(20260623);
    const products = SEED_PRODUCTS.map((p) => ({ ...p, active: true }));
    const orders = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let oid = 5000;
    for (let off = 119; off >= 0; off--) {
      const d = new Date(today); d.setDate(today.getDate() - off);
      const dow = d.getDay();
      const n = Math.max(1, Math.round((1 + r() * 4) * ((dow === 0 || dow === 6) ? 1.4 : 1) * (1 + 0.003 * (119 - off))));
      for (let i = 0; i < n; i++) {
        const items = [];
        const picked = new Set();
        const lines = 1 + Math.floor(r() * 2);
        for (let k = 0; k < lines; k++) {
          const p = products[Math.floor(r() * products.length)];
          if (picked.has(p.id)) continue;
          picked.add(p.id);
          items.push({ id: p.id, name: p.name, price: p.price, qty: 1 + Math.floor(r() * 2) });
        }
        const sub = items.reduce((s, it) => s + it.price * it.qty, 0);
        const shipping = sub >= 5000 ? 0 : 550;
        let status;
        const sr = r();
        if (off <= 1) status = sr < 0.7 ? "new" : (sr < 0.9 ? "shipped" : "done");
        else if (off <= 4) status = sr < 0.2 ? "new" : (sr < 0.55 ? "shipped" : "done");
        else status = sr < 0.04 ? "canceled" : "done";
        const ts = new Date(d); ts.setHours(9 + Math.floor(r() * 11), Math.floor(r() * 60));
        orders.push({
          id: `ORD-${ymd(d)}-${++oid}`, ts: ts.toISOString(), items,
          customer: SURNAMES[Math.floor(r() * SURNAMES.length)] + " " + GIVEN[Math.floor(r() * GIVEN.length)],
          sub, shipping, total: sub + shipping, status, channel: "store",
        });
      }
    }
    return { products, orders, seededAt: Date.now() };
  }

  function persist() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }
  function load() {
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.products && d.orders) return d; } catch (e) {}
    const s = seed();
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }
  let data = load();

  return {
    KEY,
    products() { return data.products; },
    orders() { return data.orders; },
    product(id) { return data.products.find((p) => p.id === id); },
    reseed() { data = seed(); persist(); },
    refresh() { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.products) data = d; } catch (e) {} },
    placeOrder(order) {
      data.orders.push(order);
      order.items.forEach((it) => { const p = this.product(it.id); if (p) p.stock = Math.max(0, p.stock - it.qty); });
      persist();
    },
    setStatus(id, status) { const o = data.orders.find((o) => o.id === id); if (o) { o.status = status; persist(); } },
    adjustStock(id, delta) { const p = this.product(id); if (p) { p.stock = Math.max(0, p.stock + delta); persist(); } },
    setActive(id, on) { const p = this.product(id); if (p) { p.active = on; persist(); } },
    save: persist,
  };
})();
