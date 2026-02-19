const NEWS = [
  {
    title: "比特币 ETF 连续净流入，机构增配节奏明显加快",
    source: "Market Pulse",
    category: "市场",
    summary: "多只现货 ETF 当周净流入扩大，推动主流交易所 BTC 永续基差回升。",
    publishedAt: "2026-02-19T08:30:00Z",
    url: "https://www.coindesk.com"
  },
  {
    title: "以太坊核心开发者讨论下一阶段执行层优化",
    source: "Protocol Watch",
    category: "基础设施",
    summary: "重点围绕执行性能、节点资源占用和开发者体验的平衡方案展开。",
    publishedAt: "2026-02-19T06:20:00Z",
    url: "https://ethereum.org"
  },
  {
    title: "Solana 生态 DePIN 项目融资回暖，硬件叙事再度升温",
    source: "VC Tracker",
    category: "融资",
    summary: "多家早期基金重新加码链上硬件网络，关注真实收入与设备激励模型。",
    publishedAt: "2026-02-18T21:45:00Z",
    url: "https://www.theblock.co"
  },
  {
    title: "美国多州提交稳定币法案补充条款，聚焦透明披露",
    source: "Policy Desk",
    category: "监管",
    summary: "新草案强调储备构成披露频率、第三方审计与消费者赎回流程。",
    publishedAt: "2026-02-18T20:40:00Z",
    url: "https://www.reuters.com"
  },
  {
    title: "跨链桥安全报告发布：多签与监控告警仍是高发薄弱点",
    source: "Security Brief",
    category: "安全",
    summary: "行业报告建议将风险建模纳入链上运营日常，并提升异常交易阻断能力。",
    publishedAt: "2026-02-18T18:15:00Z",
    url: "https://www.chainalysis.com"
  },
  {
    title: "Layer2 TVL 创季度新高，应用活跃度向社交赛道扩散",
    source: "Onchain Scope",
    category: "生态",
    summary: "头部 Rollup 的交易成本保持低位，推动高频轻量应用用户数上涨。",
    publishedAt: "2026-02-18T16:00:00Z",
    url: "https://l2beat.com"
  },
  {
    title: "亚洲交易平台上调风控阈值，应对衍生品波动放大",
    source: "Exchange Daily",
    category: "交易",
    summary: "平台同步提高部分合约保证金参数，降低高杠杆仓位连锁清算风险。",
    publishedAt: "2026-02-18T12:10:00Z",
    url: "https://www.binance.com"
  },
  {
    title: "RWA 赛道继续扩容，链上国债与信贷产品规模增长",
    source: "Asset Link",
    category: "RWA",
    summary: "机构资金偏好低波动收益类标的，推动链上真实资产发行效率提升。",
    publishedAt: "2026-02-18T09:00:00Z",
    url: "https://www.bloomberg.com"
  }
];

const feedEl = document.getElementById("feed");
const filtersEl = document.getElementById("filters");
const searchInputEl = document.getElementById("searchInput");

const totalCountEl = document.getElementById("totalCount");
const categoryCountEl = document.getElementById("categoryCount");
const updatedAtEl = document.getElementById("updatedAt");

document.getElementById("year").textContent = new Date().getFullYear();

const categories = ["全部", ...new Set(NEWS.map((item) => item.category))];
let activeCategory = "全部";
let searchKeyword = "";

function formatDate(input) {
  const date = new Date(input);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
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
  return NEWS.filter((item) => {
    const matchCategory = activeCategory === "全部" || item.category === activeCategory;
    const matchSearch =
      searchKeyword.length === 0 ||
      item.title.toLowerCase().includes(searchKeyword) ||
      item.summary.toLowerCase().includes(searchKeyword) ||
      item.source.toLowerCase().includes(searchKeyword);
    return matchCategory && matchSearch;
  }).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function renderFeed() {
  const visibleNews = filterNews();
  if (visibleNews.length === 0) {
    feedEl.innerHTML = '<div class="empty">没有匹配内容，换个关键词试试。</div>';
    return;
  }

  feedEl.innerHTML = visibleNews
    .map(
      (item) => `
      <article class="card">
        <div class="card-top">
          <span class="card-source">${item.source}</span>
          <span class="card-category">${item.category}</span>
        </div>
        <h3>${item.title}</h3>
        <p>${item.summary}</p>
        <a href="${item.url}" target="_blank" rel="noopener noreferrer">${formatDate(item.publishedAt)} · 查看来源</a>
      </article>
    `
    )
    .join("");
}

searchInputEl.addEventListener("input", (event) => {
  searchKeyword = event.target.value.trim().toLowerCase();
  renderFeed();
});

function renderSnapshot() {
  totalCountEl.textContent = String(NEWS.length);
  categoryCountEl.textContent = String(categories.length - 1);
  const newest = NEWS.reduce((latest, item) => {
    return new Date(item.publishedAt) > new Date(latest.publishedAt) ? item : latest;
  }, NEWS[0]);
  updatedAtEl.textContent = formatDate(newest.publishedAt);
}

renderFilters();
renderSnapshot();
renderFeed();
