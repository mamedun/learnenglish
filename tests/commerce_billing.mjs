import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [api, commerce, app, shop, admin, users, purchases, live] =
  await Promise.all([
    read("api/index.php"),
    read("api/commerce.php"),
    read("src/app/App.jsx"),
    read("src/features/shop/ShopPage.jsx"),
    read("src/features/admin/AdminPage.jsx"),
    read("src/features/admin/AdminUsersPanel.jsx"),
    read("src/features/admin/AdminPurchasesPanel.jsx"),
    read("src/features/live/LivePage.jsx"),
  ]);

assert.match(commerce, /wallet_admin_update/);
assert.match(commerce, /mode === 'set' \? \$value : \$current \+ \$value/);
assert.match(commerce, /random_int\(1, 999\)/);
assert.match(commerce, /time\(\) \+ 86400/);
assert.match(commerce, /purchase_validity_hours/);
assert.match(commerce, /intdiv\(\$baseAmount, 100\)/);
assert.match(commerce, /\$baseAmount % 5000 !== 0/);
assert.match(commerce, /qris_dynamic_payload\(\$staticText, \$total\)/);
assert.match(commerce, /\$baseAmount \+ \$tax \+ \$adminFee \+ \$code/);
assert.match(commerce, /expire_diamond_purchases\(\);/);
assert.match(commerce, /UPDATE diamond_purchases SET status='paid'/);
assert.match(commerce, /UPDATE users SET diamonds=diamonds\+\?/);
assert.match(commerce, /\$markPaid->rowCount\(\) !== 1/);
assert.match(commerce, /SET status='deleted'/);
assert.match(commerce, /function live_billing_recover_stale\(/);

const liveStart = commerce.indexOf("function live_billing_start(");
const liveEnd = commerce.indexOf("function live_billing_settle(", liveStart);
const liveBilling = commerce.slice(liveStart, liveEnd);
assert.match(liveBilling, /live_billing_recover_stale\(\$userId\)/);
assert.match(liveBilling, /diamonds=diamonds-10/);
assert.match(liveBilling, /reserved_blocks'\] !== 1/);
assert.match(liveBilling, /\$elapsed < 240/);
assert.match(liveBilling, /\$elapsed >= 600/);
const settle = commerce.slice(liveEnd);
assert.match(settle, /min\(600,time\(\)-\(int\)\$session\['started_at'\]\)/);
assert.match(settle, /ceil\(\$seconds\/60\)\*2/);
assert.match(settle, /\$refund = max\(0,\$reserved-\$charged\)/);

assert.match(api, /if\(\$action==='admin\/wallet'&&\$method==='PUT'\)/);
assert.match(api, /if\(\$action==='admin\/purchases'&&\$method==='GET'\)/);
assert.match(api, /if\(\$action==='shop\/purchases'&&\$method==='POST'\)/);
assert.match(api, /if\(\$action==='live-billing\/start'&&\$method==='POST'\)/);
assert.match(
  api,
  /if\(\$action==='live-billing\/started'&&\$method==='POST'\)/,
);
assert.match(api, /billing_session_id/);
assert.match(app, /live-billing\/start/);
assert.match(app, /live-billing\/started/);
assert.match(app, /live-billing\/reserve/);
assert.match(app, /live-billing\/settle/);
assert.match(app, /<ShopPage user=\{user\}/);
assert.match(app, /id: "shop", label: "Toko Diamond"/);
assert.match(shop, /QRCode\.toDataURL/);
assert.match(shop, /Tampilkan QR statis alternatif/);
assert.match(shop, /contactAdmin/);
assert.match(admin, /payment_qris_payload/);
assert.match(admin, /payment_tax_percent/);
assert.match(admin, /payment_admin_fee/);
assert.match(admin, /payment_whatsapp/);
assert.match(users, /page_size: "10"/);
assert.match(users, /mode === "set"/);
assert.match(users, /amount: value/);
assert.match(purchases, /admin\/purchases/);
assert.match(purchases, /function approve/);
assert.match(purchases, /function remove/);
assert.match(live, /10:00/);
assert.match(live, /10 diamonds \/ 5 min/);

console.log(
  "PASS: Diamond admin controls, QRIS purchases, manual approvals, and 5-minute Live reservations/settlement are wired.",
);
