import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const NEWS_JSON_PATH = path.join(PUBLIC_DIR, "news.json");
const NEWS_DIR = path.join(PUBLIC_DIR, "news");
const FEED_XML_PATH = path.join(PUBLIC_DIR, "feed.xml");
const SITEMAP_PATH = path.join(PUBLIC_DIR, "sitemap.xml");
const ROBOTS_PATH = path.join(PUBLIC_DIR, "robots.txt");

const SITE_URL = "https://www.librchain.com";
const MAX_ITEMS = 90;
const MAX_PER_SOURCE = 20;
const LOOKBACK_DAYS = 4;

const FEED_SOURCES = [
  {
    name: "CoinDesk",
    urls: ["https://www.coindesk.com/arc/outboundfeeds/rss/"]
  },
  {
    name: "Cointelegraph",
    urls: ["https://cointelegraph.com/rss"]
  },
  {
    name: "Decrypt",
    urls: ["https://decrypt.co/feed"]
  },
  {
    name: "Ethereum Blog",
    urls: ["https://blog.ethereum.org/feed.xml"]
  },
  {
    name: "Solana Blog",
    urls: ["https://solana.com/news/rss.xml", "https://solana.com/news/feed.xml"]
  },
  {
    name: "Chainalysis Blog",
    urls: ["https://www.chainalysis.com/blog/feed/"]
  },
  {
    name: "X Wire",
    urls: [
      "https://news.google.com/rss/search?q=site:x.com%20(bitcoin%20OR%20ethereum%20OR%20crypto%20OR%20blockchain)%20when:3d&hl=en-US&gl=US&ceid=US:en"
    ]
  }
];

const SOURCE_TIMEOUT_MS = 18000;

const CATEGORY_RULES = [
  {
    category: "监管",
    keywords: ["sec", "regulator", "regulation", "policy", "law", "compliance", "etf", "法案", "监管", "合规"]
  },
  {
    category: "安全",
    keywords: ["hack", "exploit", "breach", "vulnerability", "phishing", "security", "攻击", "漏洞", "盗"]
  },
  {
    category: "基础设施",
    keywords: [
      "ethereum",
      "solana",
      "layer2",
      "layer 2",
      "rollup",
      "mainnet",
      "testnet",
      "protocol",
      "upgrade",
      "client"
    ]
  },
  {
    category: "DeFi",
    keywords: ["defi", "dex", "amm", "liquidity", "yield", "lending", "staking", "借贷", "流动性"]
  },
  {
    category: "RWA",
    keywords: ["rwa", "treasury", "bond", "tokenized", "real world asset", "国债", "资产代币化"]
  },
  {
    category: "市场",
    keywords: ["bitcoin", "btc", "eth", "price", "market", "volatility", "flow", "交易", "行情", "流入"]
  },
  {
    category: "X热点",
    keywords: ["x:", "tweet", "twitter", "thread", "space"]
  }
];

function decodeEntities(text) {
  if (!text) {
    return "";
  }

  const basic = text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ");

  return basic.replace(/&#(x?[0-9a-fA-F]+);/g, (full, raw) => {
    const isHex = raw.toLowerCase().startsWith("x");
    const num = Number.parseInt(isHex ? raw.slice(1) : raw, isHex ? 16 : 10);
    if (Number.isNaN(num)) {
      return full;
    }

    return String.fromCodePoint(num);
  });
}

function stripCdata(text) {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function stripHtml(text) {
  return text.replace(/<[^>]+>/g, " ");
}

function compactWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

function cleanText(input) {
  if (!input) {
    return "";
  }

  return compactWhitespace(decodeEntities(stripHtml(stripCdata(input))));
}

function shorten(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}…`;
}

function extractTag(block, tag) {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  return block.match(pattern)?.[1] || "";
}

function extractTagList(block, tag) {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi");
  return [...block.matchAll(pattern)].map((item) => cleanText(item[1])).filter(Boolean);
}

function parseDate(rawValue) {
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function classifyCategory(entry) {
  const blob = `${entry.source} ${entry.title} ${entry.summary} ${(entry.keywords || []).join(" ")}`.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => blob.includes(keyword.toLowerCase()))) {
      return rule.category;
    }
  }

  return "综合";
}

function extractRssItems(xml, sourceName) {
  const rawItems = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((item) => item[0]);

  return rawItems.map((block) => {
    const title = cleanText(extractTag(block, "title"));
    const url = cleanText(extractTag(block, "link"));
    const summaryRaw =
      extractTag(block, "description") || extractTag(block, "content:encoded") || extractTag(block, "content");
    const summary = shorten(cleanText(summaryRaw), 240);
    const publishedAt =
      parseDate(extractTag(block, "pubDate")) ||
      parseDate(extractTag(block, "dc:date")) ||
      parseDate(extractTag(block, "updated")) ||
      new Date().toISOString();
    const keywords = extractTagList(block, "category");

    return {
      source: sourceName,
      title,
      summary,
      url,
      publishedAt,
      keywords
    };
  });
}

function extractAtomItems(xml, sourceName) {
  const rawItems = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((item) => item[0]);

  return rawItems.map((block) => {
    const title = cleanText(extractTag(block, "title"));
    const summaryRaw = extractTag(block, "summary") || extractTag(block, "content");
    const summary = shorten(cleanText(summaryRaw), 240);
    const publishedAt =
      parseDate(extractTag(block, "updated")) || parseDate(extractTag(block, "published")) || new Date().toISOString();

    const inlineLink = cleanText(extractTag(block, "link"));
    const hrefLink = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] || "";
    const url = cleanText(inlineLink || hrefLink);

    const keywords = extractTagList(block, "category");

    return {
      source: sourceName,
      title,
      summary,
      url,
      publishedAt,
      keywords
    };
  });
}

function parseFeed(xml, sourceName) {
  const looksLikeAtom = /<feed\b/i.test(xml);
  const candidates = looksLikeAtom ? extractAtomItems(xml, sourceName) : extractRssItems(xml, sourceName);

  return candidates.filter((item) => item.title && item.url);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; LibrchainBot/1.0; +https://www.librchain.com/feed.xml)",
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFirstAvailable(urls) {
  let lastError = "";

  for (const url of urls) {
    try {
      const text = await fetchText(url);
      return { text, url };
    } catch (error) {
      lastError = String(error);
    }
  }

  throw new Error(lastError || "all candidates failed");
}

async function collectFromSources() {
  const collected = [];

  for (const source of FEED_SOURCES) {
    try {
      const { text, url } = await fetchFirstAvailable(source.urls);
      const entries = parseFeed(text, source.name).slice(0, MAX_PER_SOURCE);
      collected.push(...entries);
      console.log(`feed ok: ${source.name} (${entries.length}) <- ${url}`);
    } catch (error) {
      console.warn(`feed failed: ${source.name} (${error})`);
    }
  }

  return collected;
}

function dedupeAndNormalize(rawItems) {
  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const seen = new Set();
  const slugSeen = new Set();

  const normalized = rawItems
    .map((entry) => {
      const canonicalUrl = normalizeUrl(entry.url);
      const publishedAt = parseDate(entry.publishedAt) || new Date().toISOString();
      const base = {
        source: entry.source,
        title: compactWhitespace(entry.title || ""),
        summary: compactWhitespace(entry.summary || ""),
        url: canonicalUrl,
        publishedAt,
        keywords: Array.isArray(entry.keywords) ? entry.keywords : []
      };

      return {
        ...base,
        category: base.source.toLowerCase().startsWith("x ") ? "X热点" : classifyCategory(base)
      };
    })
    .filter((entry) => entry.title && entry.url)
    .filter((entry) => {
      const ts = new Date(entry.publishedAt).getTime();
      return !Number.isNaN(ts) && ts >= cutoff;
    })
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  const output = [];
  for (const entry of normalized) {
    const fingerprint = `${entry.url}|${entry.title.toLowerCase()}`;
    if (seen.has(fingerprint)) {
      continue;
    }

    seen.add(fingerprint);

    const day = entry.publishedAt.slice(0, 10).replaceAll("-", "");
    const baseSlug = slugify(entry.title) || "news";
    let slug = `${day}-${baseSlug}`;
    let suffix = 2;
    while (slugSeen.has(slug)) {
      slug = `${day}-${baseSlug}-${suffix}`;
      suffix += 1;
    }
    slugSeen.add(slug);

    output.push({
      ...entry,
      slug,
      localUrl: `/news/${slug}.html`
    });

    if (output.length >= MAX_ITEMS) {
      break;
    }
  }

  return output;
}

async function loadExistingItems() {
  try {
    const raw = await fs.readFile(NEWS_JSON_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : parsed.items;
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderArticlePage(item) {
  const canonical = `${SITE_URL}${item.localUrl}`;
  const sourceHost = (() => {
    try {
      return new URL(item.url).hostname;
    } catch {
      return item.source;
    }
  })();

  const schema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: item.title,
    datePublished: item.publishedAt,
    dateModified: item.publishedAt,
    articleSection: item.category,
    mainEntityOfPage: canonical,
    publisher: {
      "@type": "Organization",
      name: "LIBRCHAIN"
    },
    isBasedOn: item.url,
    description: item.summary
  };

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(item.title)} | LIBRCHAIN</title>
    <meta name="description" content="${escapeHtml(item.summary)}" />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(item.title)}" />
    <meta property="og:description" content="${escapeHtml(item.summary)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="article:published_time" content="${escapeHtml(item.publishedAt)}" />
    <meta property="article:section" content="${escapeHtml(item.category)}" />
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        padding: 28px 18px 36px;
        font-family: "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: linear-gradient(160deg, #05080f 0%, #090d14 45%, #0d1220 100%);
        color: #ecf3ff;
      }
      main {
        width: min(760px, 100%);
        margin: 0 auto;
        border: 1px solid rgba(132, 162, 206, 0.25);
        border-radius: 18px;
        background: rgba(13, 20, 33, 0.9);
        padding: 22px;
      }
      .meta {
        font-size: 0.9rem;
        color: #8fa3c4;
        margin-bottom: 14px;
      }
      h1 {
        margin: 0 0 16px;
        line-height: 1.35;
        font-size: clamp(1.4rem, 2.8vw, 2rem);
      }
      p {
        color: #ccdaf2;
        line-height: 1.7;
      }
      .links {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 18px;
      }
      .links a {
        text-decoration: none;
        color: #0b1725;
        background: #37f0c1;
        border-radius: 999px;
        padding: 8px 12px;
        font-size: 0.9rem;
      }
      .links a.secondary {
        background: transparent;
        color: #37f0c1;
        border: 1px solid rgba(55, 240, 193, 0.6);
      }
    </style>
    <script type="application/ld+json">${JSON.stringify(schema)}</script>
  </head>
  <body>
    <main>
      <div class="meta">${escapeHtml(item.category)} · ${escapeHtml(item.source)} · ${escapeHtml(
        new Date(item.publishedAt).toLocaleString("zh-CN", { hour12: false })
      )}</div>
      <h1>${escapeHtml(item.title)}</h1>
      <p>${escapeHtml(item.summary)}</p>
      <p>来源域名：${escapeHtml(sourceHost)}</p>
      <div class="links">
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">查看原始来源</a>
        <a class="secondary" href="/">返回 LIBRCHAIN 首页</a>
      </div>
    </main>
  </body>
</html>
`;
}

async function writeNewsPages(items) {
  await fs.rm(NEWS_DIR, { recursive: true, force: true });
  await fs.mkdir(NEWS_DIR, { recursive: true });

  await Promise.all(
    items.map((item) => {
      const filePath = path.join(NEWS_DIR, `${item.slug}.html`);
      return fs.writeFile(filePath, renderArticlePage(item), "utf8");
    })
  );
}

async function writeFeedXml(items) {
  const top = items.slice(0, 60);
  const rssItems = top
    .map((item) => {
      const link = `${SITE_URL}${item.localUrl}`;
      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <description>${escapeXml(item.summary)}</description>
      <pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>
      <source url="${escapeXml(item.url)}">${escapeXml(item.source)}</source>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>LIBRCHAIN 区块链新闻雷达</title>
    <link>${SITE_URL}/</link>
    <description>每小时自动更新的区块链新闻、博客与 X 热点聚合</description>
    <language>zh-cn</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${rssItems}
  </channel>
</rss>
`;

  await fs.writeFile(FEED_XML_PATH, xml, "utf8");
}

async function writeSitemap(items) {
  const now = new Date().toISOString();
  const entries = [
    { loc: `${SITE_URL}/`, lastmod: now, changefreq: "hourly", priority: "1.0" },
    { loc: `${SITE_URL}/feed.xml`, lastmod: now, changefreq: "hourly", priority: "0.5" }
  ];

  for (const item of items) {
    entries.push({
      loc: `${SITE_URL}${item.localUrl}`,
      lastmod: item.publishedAt,
      changefreq: "daily",
      priority: "0.7"
    });
  }

  const body = entries
    .map(
      (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${escapeXml(entry.lastmod)}</lastmod>
    <changefreq>${escapeXml(entry.changefreq)}</changefreq>
    <priority>${escapeXml(entry.priority)}</priority>
  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

  await fs.writeFile(SITEMAP_PATH, xml, "utf8");
}

async function writeRobots() {
  const body = `User-agent: *
Allow: /
Sitemap: ${SITE_URL}/sitemap.xml
`;
  await fs.writeFile(ROBOTS_PATH, body, "utf8");
}

async function main() {
  const fetched = await collectFromSources();
  let items = dedupeAndNormalize(fetched);

  if (items.length === 0) {
    const existingItems = await loadExistingItems();
    items = dedupeAndNormalize(existingItems);
    console.warn(`no fresh feed collected; falling back to existing items (${items.length})`);
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    total: items.length,
    items
  };

  await fs.writeFile(NEWS_JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeNewsPages(items);
  await writeFeedXml(items);
  await writeSitemap(items);
  await writeRobots();

  console.log(`generated: ${items.length} items`);
  console.log(`output: ${path.relative(ROOT_DIR, NEWS_JSON_PATH)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
