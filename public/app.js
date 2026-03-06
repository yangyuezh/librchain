const feedEl = document.getElementById("feed");
const filtersEl = document.getElementById("filters");
const searchInputEl = document.getElementById("searchInput");
const totalCountEl = document.getElementById("totalCount");
const categoryCountEl = document.getElementById("categoryCount");
const updatedAtEl = document.getElementById("updatedAt");
const REMOTE_NEWS_URL =
  "https://raw.githubusercontent.com/yangyuezh/librchain/main/public/news.json";
const LOCAL_NEWS_URL = "./news.json";

document.getElementById("year").textContent = new Date().getFullYear();

let newsItems = [];
let categories = ["全部"];
let activeCategory = "全部";
let searchKeyword = "";
let currentDataOrigin = "local";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function normalizedItems(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((item) => item && item.title && (item.localUrl || item.url))
    .map((item) => ({
      title: String(item.title),
      source: String(item.source || "Unknown"),
      category: String(item.category || "综合"),
      summary: String(item.summary || "暂无摘要"),
      publishedAt: item.publishedAt || new Date().toISOString(),
      url: item.url || "",
      localUrl: item.localUrl || ""
    }))
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function renderFilters() {
  filtersEl.innerHTML = "";
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-btn ${activeCategory === category ? "active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      activeCategory = category;
      renderFilters();
      renderFeed();
    });
    filtersEl.appendChild(button);
  });
}

function filterNews() {
  return newsItems.filter((item) => {
    const matchCategory = activeCategory === "全部" || item.category === activeCategory;
    const lowerTitle = item.title.toLowerCase();
    const lowerSummary = item.summary.toLowerCase();
    const lowerSource = item.source.toLowerCase();
    const matchSearch =
      searchKeyword.length === 0 ||
      lowerTitle.includes(searchKeyword) ||
      lowerSummary.includes(searchKeyword) ||
      lowerSource.includes(searchKeyword);
    return matchCategory && matchSearch;
  });
}

function renderFeed() {
  const visibleNews = filterNews();

  if (visibleNews.length === 0) {
    feedEl.innerHTML = '<div class="empty">没有匹配内容，换个关键词试试。</div>';
    return;
  }

  feedEl.innerHTML = visibleNews
    .map((item) => {
      const showLocalDetail = currentDataOrigin === "local" && Boolean(item.localUrl);
      const sourceLink = item.url || item.localUrl;
      const detailLink = item.localUrl || item.url;
      const detailMarkup = showLocalDetail
        ? `<a href="${escapeHtml(detailLink)}">站内详情</a>`
        : "";
      const sourceLabel = showLocalDetail ? "原始来源" : "阅读全文";

      return `
      <article class="card">
        <div class="card-top">
          <span class="card-source">${escapeHtml(item.source)}</span>
          <span class="card-category">${escapeHtml(item.category)}</span>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.summary)}</p>
        <p class="card-meta">${formatDate(item.publishedAt)}</p>
        <div class="card-links">
          ${detailMarkup}
          <a href="${escapeHtml(sourceLink)}" target="_blank" rel="noopener noreferrer">${sourceLabel}</a>
        </div>
      </article>
    `;
    })
    .join("");
}

function renderSnapshot(updatedAtFromFeed) {
  totalCountEl.textContent = String(newsItems.length);
  categoryCountEl.textContent = String(Math.max(categories.length - 1, 0));
  const fallback = newsItems[0]?.publishedAt ?? new Date().toISOString();
  updatedAtEl.textContent = formatDate(updatedAtFromFeed || fallback);
}

async function fetchNewsPayload(url) {
  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`新闻数据请求失败: ${response.status}`);
  }

  return response.json();
}

async function loadLatestPayload() {
  const sources = [
    {
      name: "remote",
      url: `${REMOTE_NEWS_URL}?ts=${Date.now()}`
    },
    {
      name: "local",
      url: `${LOCAL_NEWS_URL}?ts=${Date.now()}`
    }
  ];

  let lastError;

  for (const source of sources) {
    try {
      const payload = await fetchNewsPayload(source.url);
      currentDataOrigin = source.name;
      return payload;
    } catch (error) {
      lastError = error;
      console.warn(`News load fallback from ${source.name} source`, error);
    }
  }

  currentDataOrigin = "local";
  throw lastError ?? new Error("新闻数据请求失败");
}

async function loadNews() {
  feedEl.innerHTML = '<div class="empty">正在加载最新新闻...</div>';

  try {
    const payload = await loadLatestPayload();
    const items = Array.isArray(payload) ? payload : payload.items;
    newsItems = normalizedItems(items);

    categories = ["全部", ...new Set(newsItems.map((item) => item.category))];
    if (!categories.includes(activeCategory)) {
      activeCategory = "全部";
    }

    renderFilters();
    renderSnapshot(payload.updatedAt);
    renderFeed();
  } catch (error) {
    console.error(error);
    categories = ["全部"];
    newsItems = [];
    renderFilters();
    renderSnapshot();
    feedEl.innerHTML = '<div class="empty">新闻加载失败，请稍后刷新重试。</div>';
  }
}

searchInputEl.addEventListener("input", (event) => {
  searchKeyword = event.target.value.trim().toLowerCase();
  renderFeed();
});

loadNews();
