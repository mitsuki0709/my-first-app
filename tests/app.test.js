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

const { editProduct, persistEdit } = require('../app.js');
const oldJan = '4901234567894';
const newJan = '12345670';
const sample = () => [{ id: 'a', name: '牛乳', expiry: '2026-09-10', jan: oldJan, checked: true }];
const values = { name: '低脂肪乳', expiry: '2026-09-12', jan: newJan };

test('編集は確認済み・IDを維持し、入力配列や記憶を変更しない', () => {
  const products = sample();
  const catalog = { [oldJan]: '牛乳', other: '別商品' };
  const before = JSON.stringify({ products, catalog });
  const result = editProduct(products, catalog, 'a', values);
  assert.deepEqual(result.products[0], { id: 'a', ...values, checked: true });
  assert.deepEqual(result.catalog, { [newJan]: '低脂肪乳', other: '別商品' });
  assert.equal(JSON.stringify({ products, catalog }), before);
});

test('同じJANの商品名変更は次回入力用の記憶を更新する', () => {
  const result = editProduct(sample(), { [oldJan]: '牛乳' }, 'a', { ...values, jan: oldJan });
  assert.equal(result.catalog[oldJan], '低脂肪乳');
});

test('旧JANを別商品が使っていればその名前を記憶し、別商品は変更しない', () => {
  const other = { id: 'b', name: '残る牛乳', expiry: '2026-09-15', jan: oldJan, checked: false };
  const result = editProduct([...sample(), other], { [oldJan]: '牛乳' }, 'a', values);
  assert.equal(result.catalog[oldJan], '残る牛乳');
  assert.deepEqual(result.products[1], other);
});

test('JANを空欄にでき、未確認状態も維持する', () => {
  const products = [{ ...sample()[0], checked: false }];
  const result = editProduct(products, { [oldJan]: '牛乳' }, 'a', { ...values, jan: '' });
  assert.equal(result.products[0].jan, '');
  assert.equal(result.products[0].checked, false);
  assert.deepEqual(result.catalog, {});
});

test('期限だけの編集では他の商品が記憶した名前を上書きしない', () => {
  const result = editProduct(sample(), { [oldJan]: '別の名前' }, 'a', { ...sample()[0], expiry: '2026-09-20' });
  assert.equal(result.catalog[oldJan], '別の名前');
});

test('JANなしの既存商品にもJAN-13を追加できる', () => {
  const result = editProduct([{ ...sample()[0], jan: undefined }], {}, 'a', { ...values, jan: oldJan });
  assert.equal(result.catalog[oldJan], values.name);
});

test('不正JAN・空白名・長すぎる名前・不正日付・存在しない商品を拒否する', () => {
  for (const invalid of [{ jan: '1234' }, { jan: '4901234567890' }, { name: '  ' }, { name: 'あ'.repeat(61) }, { expiry: '' }, { expiry: '2026-02-30' }]) {
    assert.throws(() => editProduct(sample(), {}, 'a', { ...values, ...invalid }));
  }
  assert.throws(() => editProduct(sample(), {}, 'missing', values));
});

function memoryStorage(failAt) {
  const map = new Map([
    ['expiry-watcher-products', JSON.stringify(sample())],
    ['expiry-watcher-jan-catalog', JSON.stringify({ [oldJan]: '牛乳' })],
  ]);
  let writes = 0;
  return {
    map,
    getItem: key => map.get(key) ?? null,
    setItem(key, value) { if (++writes === failAt) throw new Error('QuotaExceededError'); map.set(key, value); },
    removeItem: key => map.delete(key),
  };
}

test('編集商品と記憶を保存し、再読み込み可能なJSONにする', () => {
  const storage = memoryStorage();
  const next = editProduct(sample(), { [oldJan]: '牛乳' }, 'a', values);
  persistEdit(storage, next);
  assert.deepEqual(JSON.parse(storage.getItem('expiry-watcher-products')), next.products);
  assert.deepEqual(JSON.parse(storage.getItem('expiry-watcher-jan-catalog')), next.catalog);
});

for (const failAt of [1, 2]) {
  test(`保存${failAt}回目の失敗では元の保存内容を維持する`, () => {
    const storage = memoryStorage(failAt);
    const before = [...storage.map];
    assert.throws(() => persistEdit(storage, editProduct(sample(), {}, 'a', values)));
    assert.deepEqual([...storage.map], before);
  });
}

// Run the real event handlers with an in-memory DOM/storage; no browser data is used.
function mountApp(storage = memoryStorage()) {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  class Element {
    constructor() { this.handlers = {}; this.children = []; this.parts = {}; this.dataset = {}; this.value = ''; this.isConnected = true; this.classList = { add() {} }; }
    addEventListener(type, handler) { (this.handlers[type] ||= []).push(handler); }
    emit(type) { for (const handler of this.handlers[type] || []) handler({ preventDefault() {} }); }
    setAttribute() {}
    focus() {}
    reset() {}
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
    replaceChildren() { this.children = []; }
    append(child) { this.children.push(child); }
    querySelector(selector) { return this.parts[selector] ||= new Element(); }
    querySelectorAll(selector) { return this.children.map(child => child.querySelector(selector)); }
    cloneNode() { return new Element(); }
  }
  const elements = {};
  for (const match of html.matchAll(/id="([^"]+)"/g)) elements['#' + match[1]] = new Element();
  elements['#product-template'].content = { firstElementChild: new Element() };
  const document = { querySelector(selector) { assert.ok(elements[selector], `HTML contains ${selector}`); return elements[selector]; } };
  const window = { confirm: () => true, setTimeout() {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../app.js'), 'utf8'), { document, window, localStorage: storage });
  return { elements, storage, card: () => elements['#product-list'].children[0] };
}

test('実際の編集イベントで開く・キャンセル・保存・名前記憶・再読込が連動する', () => {
  const { elements: e, storage, card } = mountApp();
  const before = [...storage.map];
  card().querySelector('.edit-button').emit('click');
  assert.equal(e['#edit-dialog'].open, true);
  assert.equal(e['#edit-name'].value, '牛乳');
  e['#edit-name'].value = 'キャンセルする名前';
  e['#cancel-edit'].emit('click');
  assert.equal(e['#edit-dialog'].open, false);
  assert.deepEqual([...storage.map], before);
  card().querySelector('.edit-button').emit('click');
  assert.equal(e['#edit-name'].value, '牛乳');
  e['#edit-name'].value = values.name;
  e['#edit-expiry'].value = values.expiry;
  e['#edit-jan'].value = values.jan;
  e['#edit-form'].emit('submit');
  assert.equal(e['#edit-dialog'].open, false);
  assert.equal(card().querySelector('h3').textContent, values.name);
  assert.equal(JSON.parse(storage.getItem('expiry-watcher-products'))[0].checked, true);
  e['#jan-code'].value = newJan;
  e['#jan-code'].emit('input');
  assert.equal(e['#product-name'].value, values.name);
  assert.equal(mountApp(storage).card().querySelector('h3').textContent, values.name);
});

test('編集イベントの検証エラーと保存失敗では画面・入力・元データを残す', () => {
  const storage = memoryStorage(1);
  const { elements: e, card } = mountApp(storage);
  const before = [...storage.map];
  card().querySelector('.edit-button').emit('click');
  e['#edit-jan'].value = '1234';
  e['#edit-form'].emit('submit');
  assert.match(e['#edit-message'].textContent, /JAN/);
  assert.deepEqual([...storage.map], before);
  e['#edit-jan'].value = newJan;
  e['#edit-name'].value = values.name;
  e['#edit-form'].emit('submit');
  assert.match(e['#edit-message'].textContent, /保存できません/);
  assert.equal(e['#edit-dialog'].open, true);
  assert.equal(e['#edit-name'].value, values.name);
  assert.equal(card().querySelector('h3').textContent, '牛乳');
  assert.deepEqual([...storage.map], before);
});

test('編集後も確認済み切替・登録・削除のイベントが動作する', () => {
  const { elements: e, storage, card } = mountApp();
  card().querySelector('.edit-button').emit('click');
  e['#edit-name'].value = values.name;
  e['#edit-form'].emit('submit');
  card().querySelector('.check-button').emit('click');
  assert.equal(JSON.parse(storage.getItem('expiry-watcher-products'))[0].checked, false);
  e['#product-name'].value = '追加商品';
  e['#expiry-date'].value = '2026-10-01';
  e['#product-form'].emit('submit');
  assert.equal(JSON.parse(storage.getItem('expiry-watcher-products')).length, 2);
  card().querySelector('.delete-button').emit('click');
  assert.equal(JSON.parse(storage.getItem('expiry-watcher-products')).length, 1);
});
