const test = require("node:test");
const assert = require("node:assert/strict");
const { daysUntil, getStatus, sortProducts } = require("../app.js");

const today = new Date(2026, 8, 2, 15, 30);

test("期限までの日数を日付単位で計算する", () => {
  assert.equal(daysUntil("2026-09-02", today), 0);
  assert.equal(daysUntil("2026-09-05", today), 3);
  assert.equal(daysUntil("2026-09-01", today), -1);
});

test("期限を4段階に分類する", () => {
  assert.deepEqual(getStatus("2026-09-01", today), { key: "expired", label: "期限切れ" });
  assert.deepEqual(getStatus("2026-09-02", today), { key: "urgent", label: "今日まで" });
  assert.deepEqual(getStatus("2026-09-05", today), { key: "urgent", label: "あと3日" });
  assert.deepEqual(getStatus("2026-09-09", today), { key: "soon", label: "あと7日" });
  assert.deepEqual(getStatus("2026-09-10", today), { key: "safe", label: "それ以上" });
});

test("商品を期限が近い順に並べる", () => {
  const products = [
    { name: "ヨーグルト", expiry: "2026-09-10" },
    { name: "牛乳", expiry: "2026-09-03" },
    { name: "卵", expiry: "2026-09-07" },
  ];
  assert.deepEqual(sortProducts(products).map((item) => item.name), ["牛乳", "卵", "ヨーグルト"]);
});
