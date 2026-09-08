const test = require('node:test');
const assert = require('node:assert/strict');
const { scanBarcodeImage } = require('../app.js');

const jan13 = '4901234567894';
const bits = '10100010110100111001100100100110100001001110101010100111010100001000100100100011101001011100101';

function barcodeImage(vertical = false) {
  const width = 640;
  const height = 640;
  const data = new Uint8ClampedArray(width * height * 4);
  const scale = 3;
  const start = 170;
  const center = 320;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const point = vertical ? y : x;
      const cross = vertical ? x : y;
      const module = Math.floor((point - start) / scale);
      const inBars = Math.abs(cross - center) < 50;
      const dark = inBars && module >= 0 && module < bits.length && bits[module] === '1';
      const value = dark ? 40 : 220;
      const offset = (y * width + x) * 4;
      data[offset] = data[offset + 1] = data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return { width, height, data };
}

function decodeImage(image) {
  const iterator = scanBarcodeImage(image);
  for (let calls = 0; calls <= 220; calls += 1) {
    const result = iterator.next();
    if (result.done) return result.value;
  }
  assert.fail('Scanner exceeded bounded two-orientation search count');
}

test('JAN-13を通常向きで読み取る', () => {
  assert.equal(decodeImage(barcodeImage(false)), jan13);
});

test('JAN-13を90度回転した向きでも読み取る', () => {
  assert.equal(decodeImage(barcodeImage(true)), jan13);
});
