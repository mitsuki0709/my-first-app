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
    module.exports = { parseLocalDate, daysUntil, getStatus, sortProducts, normalizeJan, isValidJan };
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
    if (!("BarcodeDetector" in window)) {
      message.textContent = "このブラウザーはカメラ読み取りに未対応です。JANコードを数字で入力してください。";
      janInput.focus();
      return;
    }
    scannerDialog.showModal();
    scannerMessage.textContent = "カメラを準備しています…";
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      cameraPreview.srcObject = cameraStream;
      await cameraPreview.play();
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const formats = ["ean_13", "ean_8"].filter((format) => supported.includes(format));
      if (!formats.length) throw new Error("JAN形式に対応していません");
      const detector = new window.BarcodeDetector({ formats });
      scannerMessage.textContent = "バーコード全体を明るい場所で枠内に映してください。";
      let detecting = false;
      scanTimer = window.setInterval(async () => {
        if (detecting || cameraPreview.readyState < 2) return;
        detecting = true;
        try {
          const codes = await detector.detect(cameraPreview);
          const jan = codes.map((code) => normalizeJan(code.rawValue)).find(isValidJan);
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
