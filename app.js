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
          const normalized = candidate.map((run) => String(run.color).repeat(Math.max(1, Math.min(4, Math.round(run.length / unit))))).join("");
          const result = decodeModules(bits) || decodeModules(normalized);
          if (result) return result;
        }
      }
      return null;
    };
    return tryDirection(pixels) || tryDirection([...pixels].reverse());
  }

  // Match the centered object-fit: cover preview and include margin around the guide.
  function scannerCrop(videoWidth, videoHeight, viewWidth, viewHeight) {
    const scale = Math.max(viewWidth / videoWidth, viewHeight / videoHeight);
    const visibleWidth = viewWidth / scale;
    const visibleHeight = viewHeight / scale;
    return {
      x: (videoWidth - visibleWidth) / 2 + visibleWidth * 0.02,
      y: (videoHeight - visibleHeight) / 2 + visibleHeight * 0.24,
      width: visibleWidth * 0.96,
      height: visibleHeight * 0.52,
    };
  }

  // One generator step analyses one position/angle. The UI yields between short batches.
  function* scanBarcodeImage(image, decode = decodeEanLine) {
    const { width, height, data } = image;
    const positions = [0.5];
    for (let i = 1; i <= 10; i += 1) positions.push(0.5 - i * 0.04, 0.5 + i * 0.04);
    for (const slope of [0, -0.08, 0.08, -0.16, 0.16]) {
      for (const position of positions) {
        const center = position * (height - 1);
        if (center - Math.abs(slope) * width / 2 < 2 || center + Math.abs(slope) * width / 2 >= height - 2) continue;
        for (const radius of [1, 0]) {
          const light = new Float32Array(width);
          const histogram = new Uint32Array(256);
          for (let x = 0; x < width; x += 1) {
            const y = Math.round(center + (x - width / 2) * slope);
            let sum = 0;
            for (let dy = -radius; dy <= radius; dy += 1) {
              const offset = ((y + dy) * width + x) * 4;
              sum += (data[offset] * 299 + data[offset + 1] * 587 + data[offset + 2] * 114) / 1000;
            }
            light[x] = sum / (radius * 2 + 1);
            histogram[Math.round(light[x])] += 1;
          }
          let cumulative = 0, low = -1, high = 255;
          for (let value = 0; value < 256; value += 1) {
            cumulative += histogram[value];
            if (low < 0 && cumulative >= width * 0.05) low = value;
            if (cumulative >= width * 0.95) { high = value; break; }
          }
          if (high - low < 25) continue;
          const prefix = new Float64Array(width + 1);
          for (let x = 0; x < width; x += 1) prefix[x + 1] = prefix[x] + light[x];
          const windowSize = Math.max(16, Math.round(width / 16));
          for (const fraction of [0.5, 0.38, 0.62, null]) {
            const bits = new Uint8Array(width);
            for (let x = 0; x < width; x += 1) {
              const left = Math.max(0, x - windowSize), right = Math.min(width, x + windowSize + 1);
              const threshold = fraction === null ? (prefix[right] - prefix[left]) / (right - left) - 5 : low + (high - low) * fraction;
              bits[x] = light[x] < threshold ? 1 : 0;
            }
            const jan = decode(bits);
            if (jan) return jan;
          }
        }
        yield null;
      }
    }
    return null;
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

  function editProduct(products, catalog, id, values) {
    const original = products.find((product) => product.id === id);
    if (!original) throw new Error("商品が見つかりません。編集を閉じて確認してください。");
    const name = String(values.name || "").trim();
    const expiry = String(values.expiry || "");
    const jan = normalizeJan(values.jan);
    if (!name || name.length > 60) throw new Error("商品名を1〜60文字で入力してください。");
    const date = parseLocalDate(expiry);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || Number.isNaN(date.getTime()) ||
        date.getFullYear() !== Number(expiry.slice(0, 4)) || date.getMonth() + 1 !== Number(expiry.slice(5, 7)) ||
        date.getDate() !== Number(expiry.slice(8))) throw new Error("正しい賞味期限を入力してください。");
    if (jan && !isValidJan(jan)) throw new Error("JANコードを確認してください（正しい8桁または13桁）。");
    const updated = { ...original, name, expiry, jan };
    const nextCatalog = { ...catalog };
    // Retain the old JAN's name only when another registered product uses it.
    if (original.jan && original.jan !== jan) {
      const remaining = products.find((product) => product.id !== id && product.jan === original.jan);
      if (remaining) nextCatalog[original.jan] = remaining.name;
      else delete nextCatalog[original.jan];
    }
    // Date-only edits must not replace a name remembered by another product.
    if (jan && (original.jan !== jan || original.name !== name)) nextCatalog[jan] = name;
    return { products: products.map((product) => product.id === id ? updated : product), catalog: nextCatalog };
  }

  function persistProducts(storage, nextProducts) {
    storage.setItem(STORAGE_KEY, JSON.stringify(nextProducts));
  }

  function persistEdit(storage, next) {
    const previousProducts = storage.getItem(STORAGE_KEY);
    persistProducts(storage, next.products);
    try {
      storage.setItem(CATALOG_KEY, JSON.stringify(next.catalog));
    } catch (error) {
      try {
        if (previousProducts === null) storage.removeItem(STORAGE_KEY);
        else storage.setItem(STORAGE_KEY, previousProducts);
      } catch {
        throw new Error("保存状態を復元できませんでした。これ以上操作せず、入力内容を控えてください。");
      }
      throw error;
    }
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { parseLocalDate, daysUntil, getStatus, sortProducts, normalizeJan, isValidJan, decodeModules, decodeEanLine, editProduct, persistProducts, persistEdit, scannerCrop, scanBarcodeImage };
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
  const editDialog = document.querySelector("#edit-dialog");
  const editForm = document.querySelector("#edit-form");
  const editName = document.querySelector("#edit-name");
  const editExpiry = document.querySelector("#edit-expiry");
  const editJan = document.querySelector("#edit-jan");
  const editMessage = document.querySelector("#edit-message");
  let editingId = null;
  let editTrigger = null;
  let products = loadProducts();
  let catalog = loadCatalog();
  let cameraStream = null;
  let scanTimer = null;
  let scannerSession = 0;

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
      const editButton = node.querySelector(".edit-button");
      editButton.dataset.productId = product.id;
      editButton.setAttribute("aria-label", `${product.name}を編集`);
      editButton.addEventListener("click", () => {
        editingId = product.id;
        editTrigger = editButton;
        editName.value = product.name;
        editExpiry.value = product.expiry;
        editJan.value = product.jan || "";
        editMessage.textContent = "";
        editDialog.showModal();
        editName.focus();
      });
      list.append(node);
    });
  }

  document.querySelector("#cancel-edit").addEventListener("click", () => editDialog.close());
  editDialog.addEventListener("close", () => {
    editingId = null;
    editForm.reset();
    if (editTrigger && editTrigger.isConnected) editTrigger.focus();
  });
  editForm.addEventListener("submit", (event) => {
    event.preventDefault();
    let next;
    try {
      next = editProduct(products, catalog, editingId, { name: editName.value, expiry: editExpiry.value, jan: editJan.value });
    } catch (error) {
      editMessage.textContent = error.message;
      return;
    }
    try {
      persistEdit(localStorage, next);
    } catch (error) {
      editMessage.textContent = error.message.startsWith("保存状態") ? error.message : "保存できませんでした。入力内容は残っています。空き容量やブラウザーの設定を確認して再試行してください。";
      return;
    }
    products = next.products;
    catalog = next.catalog;
    const savedId = editingId;
    render();
    editTrigger = [...list.querySelectorAll(".edit-button")].find((button) => button.dataset.productId === savedId);
    editDialog.close();
    message.textContent = "商品を編集して保存しました。";
  });

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
    scannerSession += 1;
    if (scanTimer) window.clearTimeout(scanTimer);
    scanTimer = null;
    if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    cameraPreview.srcObject = null;
    if (scannerDialog.open) scannerDialog.close();
  }

  async function startScanner() {
    if (scannerDialog.open) return;
    const session = ++scannerSession;
    scannerDialog.showModal();
    scannerMessage.textContent = "カメラを準備しています…";
    const active = () => session === scannerSession && scannerDialog.open;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: {
        facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 24, max: 30 },
      }, audio: false });
      if (!active()) { stream.getTracks().forEach((track) => track.stop()); return; }
      cameraStream = stream;
      cameraPreview.srcObject = stream;
      await cameraPreview.play();
      if (!active()) return;
      const track = stream.getVideoTracks()[0];
      try {
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        const advanced = {};
        for (const key of ["focusMode", "exposureMode", "whiteBalanceMode"]) {
          if (capabilities[key] && capabilities[key].includes("continuous")) advanced[key] = "continuous";
        }
        if (Object.keys(advanced).length) await track.applyConstraints({ advanced: [advanced] });
      } catch { /* Optional camera controls must never block scanning. */ }
      if (!active()) return;
      let detector = null;
      if ("BarcodeDetector" in window) {
        try {
          const supported = await window.BarcodeDetector.getSupportedFormats();
          const formats = ["ean_13", "ean_8"].filter((format) => supported.includes(format));
          if (formats.length) detector = new window.BarcodeDetector({ formats });
        } catch { detector = null; }
      }
      if (!active()) return;
      scannerMessage.textContent = "左右の白い余白ごと緑枠に入れ、1〜2秒静止してください。ピントが合わなければ少し離してください。";
      const context = scanCanvas.getContext("2d", { willReadFrequently: true });
      let iterator = null, lastJan = null, lastSeen = 0;
      const started = Date.now();
      async function scan() {
        if (!active()) return;
        let jan = null;
        try {
          if (cameraPreview.readyState < 2 || !cameraPreview.videoWidth) return;
          if (detector) {
            try {
              const codes = await detector.detect(cameraPreview);
              if (!active()) return;
              jan = codes.map((code) => normalizeJan(code.rawValue)).find(isValidJan);
            } catch { detector = null; }
          }
          if (!detector) {
            if (!iterator) {
              const bounds = cameraPreview.getBoundingClientRect();
              const crop = scannerCrop(cameraPreview.videoWidth, cameraPreview.videoHeight, bounds.width, bounds.height);
              const width = Math.min(1280, Math.round(crop.width));
              const height = Math.max(1, Math.round(width * crop.height / crop.width));
              if (scanCanvas.width !== width) scanCanvas.width = width;
              if (scanCanvas.height !== height) scanCanvas.height = height;
              context.drawImage(cameraPreview, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
              iterator = scanBarcodeImage(context.getImageData(0, 0, width, height));
            }
            const deadline = performance.now() + 18;
            for (let batch = 0; batch < 4; batch += 1) {
              const result = iterator.next();
              if (result.done) { jan = result.value; iterator = null; break; }
              if (performance.now() >= deadline) break;
            }
          }
          if (jan) {
            const now = Date.now();
            // Require the same checksum-valid JAN in two separately captured frames.
            if (jan === lastJan && now - lastSeen < 2500) { stopScanner(); applyJan(jan, true); return; }
            lastJan = jan;
            lastSeen = now;
            scannerMessage.textContent = "読み取り候補を確認中です。そのまま少し静止してください。";
          } else if (Date.now() - started > 6000 && Date.now() - lastSeen > 2500) {
            scannerMessage.textContent = "反射を避け、バーを横向きにして少し近づける・離すと読みやすくなります。難しい場合はキャンセルして数字で入力できます。";
          }
        } catch {
          iterator = null;
          scannerMessage.textContent = "ピントと反射を確認してください。読み取りを続けています。";
        } finally {
          if (active()) scanTimer = window.setTimeout(scan, iterator ? 16 : 140);
        }
      }
      scanTimer = window.setTimeout(scan, 140);
    } catch (error) {
      if (!active()) return;
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
    const nextProducts = products.map((product) => product.id === id ? { ...product, checked: !product.checked } : product);
    try {
      persistProducts(localStorage, nextProducts);
    } catch {
      message.textContent = "確認状態を保存できませんでした。表示は変更していません。空き容量やブラウザーの設定を確認して再試行してください。";
      return;
    }
    products = nextProducts;
    render();
  }

  function removeProduct(id) {
    const product = products.find((item) => item.id === id);
    if (!product || !window.confirm(`「${product.name}」を削除しますか？`)) return;
    const nextProducts = products.filter((item) => item.id !== id);
    try {
      persistProducts(localStorage, nextProducts);
    } catch {
      message.textContent = "削除を保存できませんでした。商品は削除していません。空き容量やブラウザーの設定を確認して再試行してください。";
      return;
    }
    products = nextProducts;
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
    const nextProducts = [...products, { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, name, expiry: dateInput.value, checked: false, jan }];
    const nextCatalog = jan ? { ...catalog, [jan]: name } : catalog;
    try {
      if (jan) persistEdit(localStorage, { products: nextProducts, catalog: nextCatalog });
      else persistProducts(localStorage, nextProducts);
    } catch (error) {
      message.textContent = error.message.startsWith("保存状態") ? error.message : "商品を保存できませんでした。入力内容は残っています。空き容量やブラウザーの設定を確認して再試行してください。";
      return;
    }
    products = nextProducts;
    catalog = nextCatalog;
    render();
    form.reset();
    message.textContent = `「${name}」を登録しました。`;
    nameInput.focus();
    window.setTimeout(() => { message.textContent = ""; }, 3000);
  });

  render();
}());
