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
function mountApp(storage = memoryStorage(), options = {}) {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  class Element {
    constructor() { this.handlers = {}; this.children = []; this.parts = {}; this.dataset = {}; this.value = ''; this.isConnected = true; this.classList = { add() {} }; }
    addEventListener(type, handler) { (this.handlers[type] ||= []).push(handler); }
    emit(type) { return Promise.all((this.handlers[type] || []).map(handler => handler({ preventDefault() {} }))); }
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
    async play() {}
    getContext() { return options.context || {}; }
    getBoundingClientRect() { return { width: 400, height: 300 }; }
  }
  const elements = {};
  for (const match of html.matchAll(/id="([^"]+)"/g)) elements['#' + match[1]] = new Element();
  elements['#product-template'].content = { firstElementChild: new Element() };
  const document = { querySelector(selector) { assert.ok(elements[selector], `HTML contains ${selector}`); return elements[selector]; } };
  const window = { confirm: () => true, setTimeout() {}, ...options.window };
  vm.runInNewContext(fs.readFileSync(require.resolve('../app.js'), 'utf8'), { document, window, localStorage: storage, navigator: options.navigator, performance });
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

const { scannerCrop, scanBarcodeImage } = require('../app.js');
const jan13Bits = '10100010110100111001100100100110100001001110101010100111010100001000100100100011101001011100101';
const jan8Bits = '1010011001001001101111010100011010101001110101000010001001110010101';
function barcodeImage(bits, options = {}) {
  const { scale = 3, left = 110, center = 180, slope = 0, noise = 0, reverse = false, gradient = false } = options;
  const width = 640, height = 360;
  const data = new Uint8ClampedArray(width * height * 4);
  let seed = 12345;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = Math.floor((x - left) / scale);
      const digit = reverse ? bits[bits.length - 1 - index] : bits[index];
      const inBars = Math.abs(y - center - slope * (x - width / 2)) < 13;
      let value = inBars && index >= 0 && index < bits.length && digit === '1' ? 40 : 220;
      if (gradient) value = value * (0.4 + 0.6 * x / width);
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      value += ((seed / 4294967296) * 2 - 1) * noise;
      const offset = (y * width + x) * 4;
      data[offset] = data[offset + 1] = data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return { width, height, data };
}
function decodeImage(image) {
  const iterator = scanBarcodeImage(image);
  for (let calls = 0; calls <= 105; calls += 1) {
    const result = iterator.next();
    if (result.done) return result.value;
  }
  assert.fail('Scanner exceeded bounded search count');
}
for (const [label, options] of [
  ['中央', {}], ['上方・左への位置ずれ', { center: 85, left: 35 }],
  ['下方・右への位置ずれ', { center: 280, left: 300, scale: 2 }],
  ['縮小・非整数倍率', { scale: 1.8 }], ['拡大', { scale: 4.5, left: 50 }],
  ['逆向き', { reverse: true }], ['画素ノイズ', { noise: 65 }],
  ['右上がり', { slope: -0.16 }], ['右下がり', { slope: 0.16 }],
  ['傾き・ノイズ・位置ずれ', { slope: 0.08, center: 130, noise: 50 }],
  ['明るさのむら', { gradient: true }],
]) {
  for (const [jan, bits] of [[oldJan, jan13Bits], [newJan, jan8Bits]]) {
    test(`画像解析 ${jan.length}桁: ${label}`, () => assert.equal(decodeImage(barcodeImage(bits, options)), jan));
  }
}
test('白紙画像・チェックディジット不正では読み取りを確定しない', () => {
  const blank = barcodeImage('');
  assert.equal(decodeImage(blank), null);
  const invalid = jan13Bits.slice(0, -10) + '1110010' + '101';
  assert.equal(decodeImage(barcodeImage(invalid)), null);
});
test('縦長カメラと横長カメラの表示切り抜きに解析領域を合わせる', () => {
  for (const [width, height] of [[1920, 1080], [1080, 1920]]) {
    const crop = scannerCrop(width, height, 400, 300);
    assert.ok(crop.x >= 0 && crop.y >= 0);
    assert.ok(crop.x + crop.width <= width && crop.y + crop.height <= height);
    assert.ok(Math.abs(crop.x + crop.width / 2 - width / 2) < 0.01);
    assert.ok(Math.abs(crop.y + crop.height / 2 - height / 2) < 0.01);
    assert.ok(Math.abs(crop.width / crop.height - (400 * 0.96) / (300 * 0.52)) < 0.01);
  }
});

test('BarcodeDetectorはJANを2フレーム確認して入力しカメラを停止する', async () => {
  const tasks = [];
  let stopped = 0, detected = 0, constraints;
  const track = { stop() { stopped += 1; }, getCapabilities: () => ({ focusMode: ['continuous'] }), async applyConstraints() { throw new Error('optional control unavailable'); } };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  class Detector {
    static async getSupportedFormats() { return ['ean_13', 'ean_8']; }
    async detect() { detected += 1; return [{ rawValue: oldJan }]; }
  }
  const { elements: e } = mountApp(memoryStorage(), {
    navigator: { mediaDevices: { async getUserMedia(value) { constraints = value; return stream; } } },
    window: { BarcodeDetector: Detector, setTimeout(fn) { tasks.push(fn); return tasks.length; }, clearTimeout() {} },
  });
  e['#camera-preview'].readyState = 2;
  e['#camera-preview'].videoWidth = 1920;
  await e['#scan-button'].emit('click');
  assert.equal(constraints.audio, false);
  assert.equal(constraints.video.width.ideal, 1920);
  await tasks.shift()();
  assert.equal(e['#scanner-dialog'].open, true);
  await tasks.shift()();
  assert.equal(detected, 2);
  assert.equal(e['#jan-code'].value, oldJan);
  assert.equal(e['#scanner-dialog'].open, false);
  assert.equal(stopped, 1);
});

test('カメラ許可待ちのキャンセルでは、後から届いた映像を停止する', async () => {
  let resolve, stopped = 0;
  const { elements: e } = mountApp(memoryStorage(), {
    navigator: { mediaDevices: { getUserMedia: () => new Promise(done => { resolve = done; }) } },
    window: { clearTimeout() {} },
  });
  const pending = e['#scan-button'].emit('click');
  await e['#cancel-scanner'].emit('click');
  resolve({ getTracks: () => [{ stop() { stopped += 1; } }] });
  await pending;
  assert.equal(stopped, 1);
  assert.equal(e['#scanner-dialog'].open, false);
  assert.equal(e['#camera-preview'].srcObject, null);
});

test('Safari経路も画像を端末内で解析し、別フレームの一致で確定する', async () => {
  const tasks = [];
  let captures = 0, stopped = 0;
  const track = { stop() { stopped += 1; } };
  const image = barcodeImage(jan8Bits);
  const { elements: e } = mountApp(memoryStorage(), {
    navigator: { mediaDevices: { async getUserMedia() { return { getTracks: () => [track], getVideoTracks: () => [track] }; } } },
    context: { drawImage() { captures += 1; }, getImageData() { return image; } },
    window: { setTimeout(fn) { tasks.push(fn); return tasks.length; }, clearTimeout() {} },
  });
  Object.assign(e['#camera-preview'], { readyState: 2, videoWidth: 1920, videoHeight: 1080 });
  await e['#scan-button'].emit('click');
  for (let i = 0; i < 100 && e['#scanner-dialog'].open; i += 1) await tasks.shift()();
  assert.equal(captures, 2);
  assert.equal(e['#jan-code'].value, newJan);
  assert.equal(stopped, 1);
});
