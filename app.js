(function () {
  "use strict";

  const STORAGE_KEY = "expiry-watcher-products";
  const CATALOG_KEY = "expiry-watcher-jan-catalog";

  function normalizeJan(value) {
    return String(value || "").replace(/[^0-9]/g, "").slice(0, 13);
  }

  function isValidJan(value) {
    const jan = normalizeJan(value);
    if (!/^(?:\d{8}|\d{13})$/.test(jan)) return false;
    const digits = [...jan].map(Number);
    const check = digits.pop();
    const sum = digits.reduce((total, digit, index) => total + digit * (index % 2 === 0 ? (jan.length === 13 ? 1 : 3) : (jan.length === 13 ? 3 : 1)), 0);
    return (10 - (sum % 10)) % 10 === check;
  }

  const EAN_LEFT_ODD = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
  const EAN_LEFT_EVEN = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
  const EAN_RIGHT = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
  const EAN13_PARITY = ["OOOOOO", "OOEOEE", "OOEEOE", "OOEEEO", "OEOOEE", "OEEOOE", "OEEEOO", "OEOEOE", "OEOEEO", "OEEOEO"];

  function decodeModules(bits) {
    if (!/^[01]+$/.test(bits) || !bits.startsWith("101") || !bits.endsWith("101")) return null;
    const digitFor = (part, patterns) => {
      const index = patterns.indexOf(part);
      return index < 0 ? null : String(index);
    };
    let jan = "";
    if (bits.length === 67 && bits.slice(31, 36) === "01010") {
      for (let offset = 3; offset < 31; offset += 7) jan += digitFor(bits.slice(offset, offset + 7), EAN_LEFT_ODD) ?? "?";
      for (let offset = 36; offset < 64; offset += 7) jan += digitFor(bits.slice(offset, offset + 7), EAN_RIGHT) ?? "?";
    } else if (bits.length === 95 && bits.slice(45, 50) === "01010") {
      let parity = "";
      let tail = "";
      for (let offset = 3; offset < 45; offset += 7) {
        const part = bits.slice(offset, offset + 7);
        const odd = digitFor(part, EAN_LEFT_ODD);
        const even = digitFor(part, EAN_LEFT_EVEN);
        parity += odd !== null ? "O" : "E";
        tail += odd ?? even ?? "?";
      }
      const first = EAN13_PARITY.indexOf(parity);
      if (first < 0) return null;
      jan = String(first) + tail;
      for (let offset = 50; offset < 92; offset += 7) jan += digitFor(bits.slice(offset, offset + 7), EAN_RIGHT) ?? "?";
    } else return null;
    return isValidJan(jan) ? jan : null;
  }

  // Decode an EAN/JAN scan line without a browser API. This is the free Safari fallback.
  function decodeEanLine(pixels) {
    const tryDirection = (line) => {
      const runs = [];
      let color = line[0];
      let start = 0;
      for (let index = 1; index <= line.length; index += 1) {
        if (index === line.length || line[index] !== color) {
          runs.push({ color, start, length: index - start });
          color = line[index];
          start = index;
        }
      }
      for (const [modules, runCount] of [[95, 59], [67, 43]]) {
        for (let first = 0; first + runCount <= runs.length; first += 1) {
          if (runs[first].color !== 1) continue;
          const candidate = runs.slice(first, first + runCount);
          const width = candidate.reduce((sum, run) => sum + run.length, 0);
          const unit = width / modules;
          if (unit < 1.2 || candidate.some((run) => run.length / unit < 0.38 || run.length / unit > 4.7)) continue;
          const left = candidate[0].start;
          let bits = "";
          for (let module = 0; module < modules; module += 1) bits += String(line[Math.min(line.length - 1, Math.floor(left + (module + 0.5) * unit))]);
          const result = decodeModules(bits);
          if (result) return result;
        }
      }
      return null;
    };
    return tryDirection(pixels) || tryDirection([...pixels].reverse());
  }

  function parseLocalDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function daysUntil(dateString, now = new Date()) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((parseLocalDate(dateString) - today) / 86400000);
  }

  function getStatus(dateString, now = new Date()) {
    const days = daysUntil(dateString, now);
    if (days < 0) return { key: "expired", label: "期限切れ" };
    if (days <= 3) return { key: "urgent", label: days === 0 ? "今日まで" : `あと${days}日` };
    if (days <= 7) return { key: "soon", label: `あと${days}日` };
    return { key: "safe", label: "それ以上" };
  }

  function sortProducts(products) {
    return [...products].sort((a, b) => a.expiry.localeCompare(b.expiry) || a.name.localeCompare(b.name, "ja"));
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { parseLocalDate, daysUntil, getStatus, sortProducts, normalizeJan, isValidJan, decodeModules, decodeEanLine };
  }

  if (typeof document === "undefined") return;

  const form = document.querySelector("#product-form");
  const nameInput = document.querySelector("#product-name");
  const dateInput = document.querySelector("#expiry-date");
  const list = document.querySelector("#product-list");
  const emptyState = document.querySelector("#empty-state");
  const count = document.querySelector("#product-count");
  const message = document.querySelector("#form-message");
  const template = document.querySelector("#product-template");
  const janInput = document.querySelector("#jan-code");
  const scanButton = document.querySelector("#scan-button");
  const scannerDialog = document.querySelector("#scanner-dialog");
  const scannerMessage = document.querySelector("#scanner-message");
  const cameraPreview = document.querySelector("#camera-preview");
  const scanCanvas = document.querySelector("#scan-canvas");
  let products = loadProducts();
  let catalog = loadCatalog();
  let cameraStream = null;
  let scanTimer = null;

  function loadCatalog() {
    try {
      const saved = JSON.parse(localStorage.getItem(CATALOG_KEY) || "{}");
      return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch { return {}; }
  }

  function loadProducts() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  function saveProducts() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }

  function formatDate(dateString) {
    return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(parseLocalDate(dateString));
  }

  function render() {
    list.replaceChildren();
    const sorted = sortProducts(products);
    count.textContent = String(sorted.length);
    emptyState.hidden = sorted.length > 0;

    sorted.forEach((product) => {
      const node = template.content.firstElementChild.cloneNode(true);
      const status = getStatus(product.expiry);
      node.classList.add(`status-${status.key}`);
      if (product.checked) node.classList.add("is-checked");
      node.querySelector("h3").textContent = product.name;
      node.querySelector(".status-badge").textContent = status.label;
      node.querySelector(".expiry").textContent = `賞味期限：${formatDate(product.expiry)}`;
      const janDisplay = node.querySelector(".jan-display");
      if (product.jan) {
        janDisplay.textContent = `JAN：${product.jan}`;
        janDisplay.hidden = false;
      }
      const checkButton = node.querySelector(".check-button");
      checkButton.textContent = product.checked ? "✓ 確認済み" : "✓ 確認済みにする";
      checkButton.addEventListener("click", () => toggleChecked(product.id));
      node.querySelector(".delete-button").addEventListener("click", () => removeProduct(product.id));
      list.append(node);
    });
  }

  function applyJan(rawValue, announce = false) {
    const jan = normalizeJan(rawValue);
    janInput.value = jan;
    if (catalog[jan]) {
      nameInput.value = catalog[jan];
      if (announce) message.textContent = `登録済みの商品名「${catalog[jan]}」を表示しました。`;
    } else if (announce) {
      nameInput.value = "";
      message.textContent = "初めてのJANコードです。商品名を入力してください。";
      nameInput.focus();
    }
  }

  function stopScanner() {
    if (scanTimer) window.clearInterval(scanTimer);
    scanTimer = null;
    if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    cameraPreview.srcObject = null;
    if (scannerDialog.open) scannerDialog.close();
  }

  async function startScanner() {
    scannerDialog.showModal();
    scannerMessage.textContent = "カメラを準備しています…";
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      cameraPreview.srcObject = cameraStream;
      await cameraPreview.play();
      let detector = null;
      if ("BarcodeDetector" in window) {
        try {
          const supported = await window.BarcodeDetector.getSupportedFormats();
          const formats = ["ean_13", "ean_8"].filter((format) => supported.includes(format));
          if (formats.length) detector = new window.BarcodeDetector({ formats });
        } catch {
          detector = null;
        }
      }
      scannerMessage.textContent = "バーコード全体を明るい場所で枠内に映してください。";
      let detecting = false;
      scanTimer = window.setInterval(async () => {
        if (detecting || cameraPreview.readyState < 2) return;
        detecting = true;
        try {
          let jan = null;
          if (detector) {
            const codes = await detector.detect(cameraPreview);
            jan = codes.map((code) => normalizeJan(code.rawValue)).find(isValidJan);
          } else {
            const width = 960;
            const height = Math.round(width * cameraPreview.videoHeight / cameraPreview.videoWidth);
            scanCanvas.width = width;
            scanCanvas.height = height;
            const context = scanCanvas.getContext("2d", { willReadFrequently: true });
            context.drawImage(cameraPreview, 0, 0, width, height);
            for (const ratio of [0.42, 0.5, 0.58]) {
              const data = context.getImageData(0, Math.floor(height * ratio), width, 1).data;
              const light = Array.from({ length: width }, (_, x) => (data[x * 4] * 299 + data[x * 4 + 1] * 587 + data[x * 4 + 2] * 114) / 1000);
              const min = Math.min(...light);
              const max = Math.max(...light);
              for (const fraction of [0.42, 0.5, 0.58]) {
                jan = decodeEanLine(light.map((value) => value < min + (max - min) * fraction ? 1 : 0));
                if (jan) break;
              }
              if (jan) break;
            }
          }
          if (jan) { stopScanner(); applyJan(jan, true); }
        } catch { scannerMessage.textContent = "読み取り中です。カメラをゆっくり動かしてください。"; }
        finally { detecting = false; }
      }, 350);
    } catch (error) {
      stopScanner();
      message.textContent = "カメラを開始できませんでした。権限とHTTPS接続を確認するか、数字で入力してください。";
      janInput.focus();
    }
  }

  janInput.addEventListener("input", () => applyJan(janInput.value));
  janInput.addEventListener("change", () => { if (janInput.value) applyJan(janInput.value, true); });
  scanButton.addEventListener("click", startScanner);
  document.querySelector("#close-scanner").addEventListener("click", stopScanner);
  document.querySelector("#cancel-scanner").addEventListener("click", stopScanner);
  scannerDialog.addEventListener("cancel", (event) => { event.preventDefault(); stopScanner(); });

  function toggleChecked(id) {
    products = products.map((product) => product.id === id ? { ...product, checked: !product.checked } : product);
    saveProducts();
    render();
  }

  function removeProduct(id) {
    const product = products.find((item) => item.id === id);
    if (!product || !window.confirm(`「${product.name}」を削除しますか？`)) return;
    products = products.filter((item) => item.id !== id);
    saveProducts();
    render();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name || !dateInput.value) return;
    const jan = normalizeJan(janInput.value);
    if (jan && !isValidJan(jan)) {
      message.textContent = "JANコードを確認してください（正しい8桁または13桁）。";
      janInput.focus();
      return;
    }
    products.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, name, expiry: dateInput.value, checked: false, jan });
    if (jan) {
      catalog[jan] = name;
      localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
    }
    saveProducts();
    render();
    form.reset();
    message.textContent = `「${name}」を登録しました。`;
    nameInput.focus();
    window.setTimeout(() => { message.textContent = ""; }, 3000);
  });

  render();
}());
