const test = require("node:test");
const assert = require("node:assert/strict");
const { daysUntil, getStatus, sortProducts, normalizeJan, isValidJan, decodeModules, decodeEanLine } = require("../app.js");

const today = new Date(2026, 8, 2, 15, 30);

test("期限までの日数を日付単位で計算する", () => {
  assert.equal(daysUntil("2026-09-02", today), 0);
  assert.equal(daysUntil("2026-09-05", today), 3);
  assert.equal(daysUntil("2026-09-01", today), -1);
});

test("JANコードは数字だけに整形し、13桁までにする", () => {
  assert.equal(normalizeJan("49 0123-4567894"), "4901234567894");
});

test("JANコードの桁数とチェックデジットを検証する", () => {
  assert.equal(isValidJan("4901234567894"), true);
  assert.equal(isValidJan("12345670"), true);
  assert.equal(isValidJan("4901234567890"), false);
  assert.equal(isValidJan("1234"), false);
});

test("Safari用デコーダーがJAN-13とJAN-8のモジュール列を読む", () => {
  assert.equal(decodeModules("10100010110100111001100100100110100001001110101010100111010100001000100100100011101001011100101"), "4901234567894");
  assert.equal(decodeModules("1010011001001001101111010100011010101001110101000010001001110010101"), "12345670");
});

test("Safari用デコーダーが余白付き・拡大・逆向きの走査線を読む", () => {
  const modules = "10100010110100111001100100100110100001001110101010100111010100001000100100100011101001011100101";
  const scanLine = [...`000000${[...modules].map((bit) => bit.repeat(3)).join("")}000000`].map(Number);
  assert.equal(decodeEanLine(scanLine), "4901234567894");
  assert.equal(decodeEanLine([...scanLine].reverse()), "4901234567894");
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
