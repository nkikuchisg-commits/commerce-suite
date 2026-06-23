"use strict";

/* ストア（販売）側。商品は DB から読み、注文は DB に書き込む（在庫も減る）。 */

const $ = (s) => document.querySelector(s);
const yen = (n) => "¥" + n.toLocaleString("ja-JP");
const FREE_SHIP = 5000, SHIP_FEE = 550;

let cart = loadCart();          // { productId: qty }
let filterCat = "すべて";
let sortKey = "popular";

function loadCart() { try { return JSON.parse(localStorage.getItem("komorebi.cart")) || {}; } catch (e) { return {}; } }
function saveCart() { try { localStorage.setItem("komorebi.cart", JSON.stringify(cart)); } catch (e) {} }

const activeProducts = () => DB.products().filter((p) => p.active);
const cats = () => ["すべて", ...[...new Set(activeProducts().map((p) => p.cat))]];
const cartCount = () => Object.values(cart).reduce((s, q) => s + q, 0);
const subtotal = () => Object.entries(cart).reduce((s, [id, q]) => { const p = DB.product(id); return s + (p ? p.price * q : 0); }, 0);
const shipping = () => (cartCount() === 0 || subtotal() >= FREE_SHIP) ? 0 : SHIP_FEE;
const grandTotal = () => subtotal() + shipping();

/* ---------- 在庫を踏まえてカートを正規化（注文後などに在庫超過を防ぐ） ---------- */
function clampCart() {
  let changed = false;
  Object.keys(cart).forEach((id) => {
    const p = DB.product(id);
    if (!p || !p.active || p.stock <= 0) { delete cart[id]; changed = true; }
    else if (cart[id] > p.stock) { cart[id] = p.stock; changed = true; }
  });
  if (changed) saveCart();
}

/* ---------- 商品一覧 ---------- */
function renderChips() {
  $("#catChips").innerHTML = cats().map((c) => `<button class="chip ${c === filterCat ? "active" : ""}" data-cat="${c}">${c}</button>`).join("");
}
function renderGrid() {
  let list = activeProducts().filter((p) => filterCat === "すべて" || p.cat === filterCat);
  const sorters = { popular: () => 0, priceAsc: (a, b) => a.price - b.price, priceDesc: (a, b) => b.price - a.price, nameAsc: (a, b) => a.name.localeCompare(b.name, "ja") };
  list = [...list].sort(sorters[sortKey]);
  $("#grid").innerHTML = list.map((p) => {
    const out = p.stock <= 0;
    const low = !out && p.stock <= 5;
    const tag = out ? '<span class="p-stocktag out">在庫切れ</span>' : (low ? `<span class="p-stocktag low">残り${p.stock}点</span>` : "");
    return `<article class="product">
      <div class="p-thumb" style="background:${p.bg}">${p.emoji}${tag}</div>
      <div class="p-body">
        <span class="p-cat">${p.cat}</span>
        <h3 class="p-name">${p.name}</h3>
        <p class="p-desc">${p.desc}</p>
        <div class="p-foot">
          <span class="p-price">${yen(p.price)}<small> 税込</small></span>
          <button class="add-btn" data-add="${p.id}" ${out ? "disabled" : ""}>${out ? "在庫切れ" : "カートに追加"}</button>
        </div>
      </div>
    </article>`;
  }).join("");
}

/* ---------- カート ---------- */
function addToCart(id) {
  const p = DB.product(id);
  if (!p || p.stock <= 0) { toast("在庫切れです"); return; }
  const cur = cart[id] || 0;
  if (cur + 1 > p.stock) { toast(`在庫は${p.stock}点までです`); return; }
  cart[id] = cur + 1; saveCart(); syncCart(); toast("カートに追加しました");
}
function setQty(id, q) {
  const p = DB.product(id);
  if (q <= 0) delete cart[id];
  else if (p && q > p.stock) { cart[id] = p.stock; toast(`在庫は${p.stock}点までです`); }
  else cart[id] = q;
  saveCart(); syncCart();
}
function syncCart() {
  const n = cartCount();
  const badge = $("#cartBadge"); badge.hidden = n === 0; badge.textContent = n;
  renderCartDrawer();
  if (!$("#checkoutView").hidden) renderCheckout();
}
function renderCartDrawer() {
  const ids = Object.keys(cart);
  const box = $("#cdItems"), foot = $("#cdFoot");
  if (!ids.length) { box.innerHTML = `<div class="cd-empty">カートは空です。<br>お気に入りの品を選んでください。</div>`; foot.innerHTML = ""; return; }
  box.innerHTML = ids.map((id) => {
    const p = DB.product(id), q = cart[id];
    return `<div class="cd-item">
      <div class="cd-thumb" style="background:${p.bg}">${p.emoji}</div>
      <div><div class="cd-name">${p.name}</div><div class="cd-unit">${yen(p.price)}（在庫${p.stock}）</div>
        <div class="cd-qty"><button class="qbtn" data-dec="${id}">−</button><span>${q}</span><button class="qbtn" data-inc="${id}">＋</button></div></div>
      <div><div class="cd-line">${yen(p.price * q)}</div><button class="cd-remove" data-rm="${id}">削除</button></div>
    </div>`;
  }).join("");
  const ship = shipping(), remain = FREE_SHIP - subtotal();
  foot.innerHTML = `${remain > 0 ? `<div class="cd-free">あと ${yen(remain)} で送料無料</div>` : `<div class="cd-free">送料無料の対象です 🎉</div>`}
    <div class="cd-row"><span>小計</span><span>${yen(subtotal())}</span></div>
    <div class="cd-row"><span>送料</span><span>${ship === 0 ? "無料" : yen(ship)}</span></div>
    <div class="cd-row total"><span>合計</span><span>${yen(grandTotal())}</span></div>
    <button class="btn btn-primary btn-block" id="goCheckout">レジに進む</button>`;
}
function openCart() { $("#cartDrawer").classList.add("open"); $("#scrim").classList.add("show"); }
function closeCart() { $("#cartDrawer").classList.remove("open"); $("#scrim").classList.remove("show"); }

/* ---------- ビュー ---------- */
function showView(which) {
  $("#shopView").hidden = which !== "shop";
  $("#checkoutView").hidden = which !== "checkout";
  $("#doneView").hidden = which !== "done";
  window.scrollTo(0, 0);
}

/* ---------- チェックアウト ---------- */
function renderCheckout() {
  const ids = Object.keys(cart);
  $("#ckItems").innerHTML = ids.map((id) => { const p = DB.product(id), q = cart[id]; return `<div class="ck-item"><span>${p.name} ×${q}</span><span>${yen(p.price * q)}</span></div>`; }).join("");
  const ship = shipping();
  $("#ckTotals").innerHTML = `<div><span>小計</span><span>${yen(subtotal())}</span></div>
    <div><span>送料</span><span>${ship === 0 ? "無料" : yen(ship)}</span></div>
    <div class="grand"><span>合計（税込）</span><span>${yen(grandTotal())}</span></div>`;
}
function validateForm(form) {
  let ok = true;
  form.querySelectorAll("[required]").forEach((el) => {
    let bad = !el.value.trim();
    if (el.type === "email" && el.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim())) bad = true;
    el.classList.toggle("invalid", bad); if (bad) ok = false;
  });
  return ok;
}
function placeOrder() {
  if (cartCount() === 0) { toast("カートが空です"); return; }
  const form = $("#ckForm");
  if (!validateForm(form)) { toast("必須項目をご確認ください"); form.querySelector(".invalid").focus(); return; }
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const no = `ORD-${ymd}-${String(Math.floor(1000 + Math.random() * 9000))}`;
  const items = Object.entries(cart).map(([id, q]) => { const p = DB.product(id); return { id, name: p.name, price: p.price, qty: q }; });
  const sub = subtotal(), ship = shipping();
  DB.placeOrder({ id: no, ts: new Date().toISOString(), items, customer: form.name.value.trim(), sub, shipping: ship, total: sub + ship, status: "new", channel: "store" });
  $("#orderNo").textContent = no;
  cart = {}; saveCart(); syncCart();
  renderChips(); renderGrid(); // 在庫表示を更新
  showView("done");
}

/* ---------- トースト ---------- */
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 1600); }

/* ---------- イベント ---------- */
$("#grid").addEventListener("click", (e) => { const b = e.target.closest("[data-add]"); if (b && !b.disabled) addToCart(b.dataset.add); });
$("#catChips").addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (b) { filterCat = b.dataset.cat; renderChips(); renderGrid(); } });
$("#sortSel").addEventListener("change", (e) => { sortKey = e.target.value; renderGrid(); });
$("#cartBtn").addEventListener("click", openCart);
$("#cdClose").addEventListener("click", closeCart);
$("#scrim").addEventListener("click", closeCart);
$("#cdItems").addEventListener("click", (e) => {
  const inc = e.target.closest("[data-inc]"), dec = e.target.closest("[data-dec]"), rm = e.target.closest("[data-rm]");
  if (inc) setQty(inc.dataset.inc, (cart[inc.dataset.inc] || 0) + 1);
  else if (dec) setQty(dec.dataset.dec, (cart[dec.dataset.dec] || 0) - 1);
  else if (rm) { setQty(rm.dataset.rm, 0); toast("削除しました"); }
});
$("#cdFoot").addEventListener("click", (e) => { if (e.target.id === "goCheckout") { if (cartCount() === 0) { toast("カートが空です"); return; } closeCart(); renderCheckout(); showView("checkout"); } });
$("#backToShop").addEventListener("click", () => showView("shop"));
$("#placeOrder").addEventListener("click", placeOrder);
$("#continueShop").addEventListener("click", () => showView("shop"));
$("#homeLink").addEventListener("click", (e) => { e.preventDefault(); showView("shop"); });
$("#ckForm").addEventListener("input", (e) => { if (e.target.classList.contains("invalid")) e.target.classList.remove("invalid"); });

/* ---------- 初期化 ---------- */
clampCart();
renderChips();
renderGrid();
syncCart();
