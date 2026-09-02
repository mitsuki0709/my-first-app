(function () {
  "use strict";

  const STORAGE_KEY = "expiry-watcher-products";

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
    module.exports = { parseLocalDate, daysUntil, getStatus, sortProducts };
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
  let products = loadProducts();

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
      const checkButton = node.querySelector(".check-button");
      checkButton.textContent = product.checked ? "✓ 確認済み" : "✓ 確認済みにする";
      checkButton.addEventListener("click", () => toggleChecked(product.id));
      node.querySelector(".delete-button").addEventListener("click", () => removeProduct(product.id));
      list.append(node);
    });
  }

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
    products.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, name, expiry: dateInput.value, checked: false });
    saveProducts();
    render();
    form.reset();
    message.textContent = `「${name}」を登録しました。`;
    nameInput.focus();
    window.setTimeout(() => { message.textContent = ""; }, 3000);
  });

  render();
}());
