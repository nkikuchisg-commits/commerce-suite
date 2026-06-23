"use strict";

/* 管理画面：ストアと同じ DB を集計してダッシュボード／注文管理／在庫管理を表示 */

const $ = (s) => document.querySelector(s);
const yen = (n) => "¥" + Math.round(n).toLocaleString("ja-JP");
const yenShort = (n) => n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1) + "万" : Math.round(n).toLocaleString("ja-JP");
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const PALETTE = ["#2563eb", "#0ea5e9", "#22c55e", "#f59e0b", "#a855f7", "#ec4899"];
let catColor = {};
function buildCatColors() {
  const cats = [...new Set(DB.products().map((p) => p.cat))];
  catColor = {}; cats.forEach((c, i) => catColor[c] = PALETTE[i % PALETTE.length]);
}

let period = 30;
let orderFilter = "all";

/* ---------- 期間ヘルパー ---------- */
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
function periodOrders(days, offsetBack = 0) {
  const to = today0(); to.setDate(to.getDate() - offsetBack); to.setHours(23, 59, 59, 999);
  const from = today0(); from.setDate(from.getDate() - offsetBack - (days - 1));
  return DB.orders().filter((o) => { const t = new Date(o.ts); return t >= from && t <= to && isSale(o); });
}
const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
const catOf = (id) => { const p = DB.product(id); return p ? p.cat : "その他"; };

/* =========================================================================
 * ダッシュボード
 * =======================================================================*/
function renderDashboard() {
  const cur = periodOrders(period), prev = periodOrders(period, period);
  const sales = sum(cur, (o) => o.total), pSales = sum(prev, (o) => o.total);
  const cnt = cur.length, pCnt = prev.length;
  const avg = cnt ? sales / cnt : 0, pAvg = pCnt ? pSales / pCnt : 0;
  const pend = DB.orders().filter((o) => o.status === "new").length;
  const delta = (a, b) => b === 0 ? null : ((a - b) / b) * 100;

  renderKPIs([
    { label: "売上高", val: yen(sales), ico: "💰", bg: "#dbeafe", fg: "#2563eb", d: delta(sales, pSales) },
    { label: "注文数", val: cnt + " 件", ico: "🧾", bg: "#dcfce7", fg: "#16a34a", d: delta(cnt, pCnt) },
    { label: "平均注文額", val: yen(avg), ico: "📊", bg: "#fef3c7", fg: "#d97706", d: delta(avg, pAvg) },
    { label: "未発送（要対応）", val: pend + " 件", ico: "📮", bg: "#ffe4e6", fg: "#e11d48", d: null },
  ]);
  renderLine(cur);
  renderDonut(cur);
  renderBar(cur);
  renderRecent();
}

function renderKPIs(cards) {
  $("#kpiRow").innerHTML = cards.map((c) => {
    let delta;
    if (c.d === null) delta = `<div class="kpi-delta flat">— 当月の対応待ち</div>`;
    else { const up = c.d >= 0; delta = `<div class="kpi-delta ${up ? "up" : "down"}">${up ? "▲" : "▼"} ${Math.abs(c.d).toFixed(1)}% <span class="vs">前期比</span></div>`; }
    return `<div class="kpi"><div class="kpi-top"><span class="kpi-label">${c.label}</span><span class="kpi-ico" style="background:${c.bg};color:${c.fg}">${c.ico}</span></div>
      <div class="kpi-val">${c.val}</div>${delta}</div>`;
  }).join("");
}

function renderLine(cur) {
  const W = 720, H = 250, padL = 52, padR = 16, padT = 14, padB = 28;
  const map = {};
  const t0 = today0();
  for (let off = period - 1; off >= 0; off--) { const d = new Date(t0); d.setDate(t0.getDate() - off); map[key(d)] = 0; }
  cur.forEach((o) => { const k = key(new Date(o.ts)); if (k in map) map[k] += o.total; });
  const keys = Object.keys(map), vals = keys.map((k) => map[k]);
  const maxV = Math.max(1, ...vals) * 1.1;
  const x = (i) => padL + (i / (keys.length - 1)) * (W - padL - padR);
  const y = (v) => H - padB - (v / maxV) * (H - padT - padB);
  let grid = "", yl = "";
  for (let g = 0; g <= 4; g++) { const v = maxV / 4 * g, yy = y(v); grid += `<line class="grid-line" x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}"/>`; yl += `<text class="axis-text" x="${padL - 8}" y="${(yy + 4).toFixed(1)}" text-anchor="end">${yenShort(v)}</text>`; }
  const pts = keys.map((k, i) => `${x(i).toFixed(1)},${y(map[k]).toFixed(1)}`).join(" ");
  const area = `${padL},${H - padB} ${pts} ${W - padR},${H - padB}`;
  let xl = ""; const step = Math.ceil(keys.length / 6);
  keys.forEach((k, i) => { if (i % step === 0 || i === keys.length - 1) { const d = new Date(k); xl += `<text class="axis-text" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${d.getMonth() + 1}/${d.getDate()}</text>`; } });
  const li = keys.length - 1;
  $("#lineChart").innerHTML = `<defs><linearGradient id="aLineArea" x1="0" y1="0" x2="0" y2="1"><stop class="g0" offset="0%"/><stop class="g1" offset="100%"/></linearGradient></defs>
    ${grid}<polygon class="area-fill" points="${area}" fill="url(#aLineArea)"/><polyline class="line-path" points="${pts}"/>
    <circle class="dot" cx="${x(li).toFixed(1)}" cy="${y(map[keys[li]]).toFixed(1)}" r="4"/>${yl}${xl}`;
  $("#lineMeta").textContent = `合計 ${yen(sum(vals.map((v) => ({ v })), (o) => o.v))}`;
}

function renderDonut(cur) {
  const byCat = {};
  cur.forEach((o) => o.items.forEach((it) => { const c = catOf(it.id); byCat[c] = (byCat[c] || 0) + it.price * it.qty; }));
  const data = Object.entries(byCat).map(([name, value]) => ({ name, value, color: catColor[name] || "#999" })).sort((a, b) => b.value - a.value);
  const total = sum(data, (d) => d.value) || 1;
  const cx = 100, cy = 100, r = 70, C = 2 * Math.PI * r;
  let offset = 0, circles = "";
  data.forEach((d) => { const len = d.value / total * C; circles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color}" stroke-width="26" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`; offset += len; });
  $("#donutChart").innerHTML = `${circles}<text class="donut-center-num" x="${cx}" y="${cy - 2}" text-anchor="middle">${yenShort(total)}</text><text class="donut-center-lbl" x="${cx}" y="${cy + 16}" text-anchor="middle">期間売上</text>`;
  $("#donutLegend").innerHTML = data.map((d) => `<li><span class="sw" style="background:${d.color}"></span><span class="lg-name">${d.name}</span><span class="lg-pct">${(d.value / total * 100).toFixed(0)}%</span></li>`).join("");
}

function renderBar(cur) {
  const byProd = {};
  cur.forEach((o) => o.items.forEach((it) => { byProd[it.id] = (byProd[it.id] || 0) + it.qty; }));
  const data = Object.entries(byProd).map(([id, qty]) => ({ name: (DB.product(id) || {}).name || id, qty, color: catColor[catOf(id)] || "#2563eb" })).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const W = 480, H = 250, padL = 150, padR = 40, padT = 8, padB = 8;
  const maxV = Math.max(1, ...data.map((d) => d.qty));
  const rowH = (H - padT - padB) / Math.max(1, data.length), barH = Math.min(24, rowH * 0.55);
  let svg = "";
  data.forEach((d, i) => {
    const cy = padT + rowH * i + rowH / 2, w = d.qty / maxV * (W - padL - padR);
    const label = d.name.length > 12 ? d.name.slice(0, 12) + "…" : d.name;
    svg += `<text class="bar-label" x="${padL - 10}" y="${(cy + 4).toFixed(1)}" text-anchor="end">${label}</text>`;
    svg += `<rect x="${padL}" y="${(cy - barH / 2).toFixed(1)}" width="${Math.max(2, w).toFixed(1)}" height="${barH}" rx="5" fill="${d.color}"/>`;
    svg += `<text class="bar-val" x="${(padL + w + 8).toFixed(1)}" y="${(cy + 4).toFixed(1)}">${d.qty}点</text>`;
  });
  $("#barChart").innerHTML = svg || `<text class="axis-text" x="240" y="125" text-anchor="middle">データがありません</text>`;
}

const STATUS = { new: ["未発送", "new"], shipped: ["発送済み", "shipped"], done: ["完了", "done"], returned: ["返品", "returned"], canceled: ["キャンセル", "canceled"] };
const STATUS_ORDER = ["new", "shipped", "done", "returned", "canceled"];
// 売上・集計の対象（キャンセルと返品は除外）
const isSale = (o) => o.status !== "canceled" && o.status !== "returned";
function renderRecent() {
  const rows = [...DB.orders()].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 6);
  $("#recentBody").innerHTML = rows.map((o) => `<tr><td>${o.id}</td><td>${o.customer}</td><td class="num">${yen(o.total)}</td><td><span class="pill ${o.status}">${STATUS[o.status][0]}</span></td></tr>`).join("");
}

/* =========================================================================
 * 注文管理
 * =======================================================================*/
function renderOrders() {
  let rows = [...DB.orders()].sort((a, b) => new Date(b.ts) - new Date(a.ts));
  if (orderFilter !== "all") rows = rows.filter((o) => o.status === orderFilter);
  rows = rows.slice(0, 60);
  $("#ordersBody").innerHTML = rows.map((o) => {
    const d = new Date(o.ts);
    const dt = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const items = o.items.map((it) => `${it.name}×${it.qty}`).join("、");
    const itemsShort = items.length > 26 ? items.slice(0, 26) + "…" : items;
    const btns = STATUS_ORDER.map((s) => {
      const active = o.status === s;
      return `<button class="st-btn ${s}${active ? " active" : ""}" data-id="${o.id}" data-status="${s}"${active ? " disabled" : ""}>${STATUS[s][0]}</button>`;
    }).join("");
    return `<tr><td>${o.id}</td><td>${dt}</td><td>${o.customer}</td><td title="${items}">${itemsShort}</td><td class="num">${yen(o.total)}</td>
      <td><div class="st-btns">${btns}</div></td></tr>`;
  }).join("") || `<tr><td colspan="6" style="text-align:center;color:#6a7a90;padding:24px">該当する注文がありません</td></tr>`;
}

/* =========================================================================
 * 商品・在庫
 * =======================================================================*/
function soldCount(id) { return sum(DB.orders().filter(isSale), (o) => sum(o.items.filter((it) => it.id === id), (it) => it.qty)); }
function renderProducts() {
  const ps = DB.products();
  const low = ps.filter((p) => p.stock > 0 && p.stock <= 5).length, out = ps.filter((p) => p.stock <= 0).length;
  $("#stockAlert").innerHTML = (low + out) ? `<div class="alert-banner" style="margin-bottom:14px">⚠ 在庫アラート：在庫切れ <strong>${out}</strong>件・残りわずか <strong>${low}</strong>件。＋ボタンで補充できます。</div>` : "";
  $("#productsBody").innerHTML = ps.map((p) => {
    const cls = p.stock <= 0 ? "out" : (p.stock <= 5 ? "low" : "");
    return `<tr>
      <td>${p.emoji} ${p.name}</td><td>${p.cat}</td><td class="num">${yen(p.price)}</td>
      <td><span class="stock-cell"><button class="sbtn" data-dec="${p.id}">−</button><span class="stock-num ${cls}">${p.stock}</span><button class="sbtn" data-inc="${p.id}">＋</button></span></td>
      <td class="num">${soldCount(p.id)}点</td>
      <td><label style="cursor:pointer"><input type="checkbox" data-active="${p.id}" ${p.active ? "checked" : ""}> ${p.active ? "公開" : "非公開"}</label></td>
    </tr>`;
  }).join("");
}

/* =========================================================================
 * ナビ・共通
 * =======================================================================*/
let section = "dash";
function showSection(sec) {
  if (sec === "store") { location.href = "index.html"; return; }
  section = sec;
  $("#secDash").hidden = sec !== "dash";
  $("#secOrders").hidden = sec !== "orders";
  $("#secProducts").hidden = sec !== "products";
  $("#secTitle").textContent = { dash: "ダッシュボード", orders: "注文管理", products: "商品・在庫" }[sec];
  $("#periodSeg").style.display = sec === "dash" ? "" : "none";
  document.querySelectorAll(".adm-nav button").forEach((b) => b.classList.toggle("active", b.dataset.sec === sec));
  if (sec === "dash") renderDashboard();
  else if (sec === "orders") renderOrders();
  else renderProducts();
  closeSide();
}
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 1600); }
function closeSide() { $("#admSide").classList.remove("open"); $("#admScrim").classList.remove("show"); }

/* ---------- ログイン ---------- */
function showApp() {
  $("#loginScreen").hidden = true; $("#adminApp").hidden = false;
  buildCatColors();
  DB.refresh();
  showSection("dash");
  // ログイン後はダッシュボードの先頭まで自動スクロール（表示されたことが分かるように）
  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
}
$("#loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = ($("#loginPass").value || "").trim().toLowerCase();
  if (v === "" || v === "demo") { try { sessionStorage.setItem("komorebi.admin", "1"); } catch (e) {} showApp(); }
  else $("#loginErr").textContent = "パスワードが違います（demo と入力するか、空欄のままログインしてください）";
});

/* ---------- イベント ---------- */
document.querySelector(".adm-nav").addEventListener("click", (e) => { const b = e.target.closest("button[data-sec]"); if (b) showSection(b.dataset.sec); });
$("#periodSeg").addEventListener("click", (e) => { const b = e.target.closest("button[data-period]"); if (!b) return; [...$("#periodSeg").children].forEach((x) => x.classList.toggle("active", x === b)); period = parseInt(b.dataset.period, 10); renderDashboard(); });
$("#orderFilter").addEventListener("click", (e) => { const b = e.target.closest(".fbtn"); if (!b) return; [...$("#orderFilter").children].forEach((x) => x.classList.toggle("active", x === b)); orderFilter = b.dataset.f; renderOrders(); });
$("#ordersBody").addEventListener("click", (e) => {
  const b = e.target.closest(".st-btn");
  if (!b || b.disabled) return;
  const restocked = DB.setStatus(b.dataset.id, b.dataset.status);
  const label = STATUS[b.dataset.status][0];
  if (b.dataset.status === "canceled") toast(restocked ? "キャンセル：在庫を戻しました" : "キャンセルにしました");
  else if (b.dataset.status === "returned") toast("返品にしました（在庫は戻しません）");
  else toast(`「${label}」に変更しました`);
  renderOrders();
});
$("#productsBody").addEventListener("click", (e) => {
  const inc = e.target.closest("[data-inc]"), dec = e.target.closest("[data-dec]");
  if (inc) { DB.adjustStock(inc.dataset.inc, +1); renderProducts(); }
  else if (dec) { DB.adjustStock(dec.dataset.dec, -1); renderProducts(); }
});
$("#productsBody").addEventListener("change", (e) => { const cb = e.target.closest("[data-active]"); if (cb) { DB.setActive(cb.dataset.active, cb.checked); renderProducts(); toast(cb.checked ? "公開にしました" : "非公開にしました"); } });
$("#reseedBtn").addEventListener("click", () => { if (confirm("デモデータを初期状態に戻します。よろしいですか？")) { DB.reseed(); toast("デモデータを初期化しました"); showSection(section); } });
$("#logoutBtn").addEventListener("click", () => { try { sessionStorage.removeItem("komorebi.admin"); } catch (e) {} location.reload(); });
$("#menuBtn").addEventListener("click", () => { $("#admSide").classList.add("open"); $("#admScrim").classList.add("show"); });
$("#admScrim").addEventListener("click", closeSide);

// 別タブのストアで注文が入ったら自動反映
window.addEventListener("storage", (e) => { if (e.key === DB.KEY) { DB.refresh(); showSection(section); } });

/* ---------- 初期化 ---------- */
(function init() {
  let logged = false;
  try { logged = sessionStorage.getItem("komorebi.admin") === "1"; } catch (e) {}
  if (logged) showApp();
})();
