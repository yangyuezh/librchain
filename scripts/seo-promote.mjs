import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const NEWS_JSON_PATH = path.join(PUBLIC_DIR, "news.json");

const SITE_URL = "https://www.librchain.com";
const INDEXNOW_KEY = "7f5d5f9f8f3145a2bb824f0f4a5885fb";
const INDEXNOW_KEY_FILE = path.join(PUBLIC_DIR, `${INDEXNOW_KEY}.txt`);

function normalizeUrl(url) {
  try {
    return new URL(url).toString();
  } catch {
    return "";
  }
}

async function readNewsUrls() {
  try {
    const raw = await fs.readFile(NEWS_JSON_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : parsed.items;

    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .slice(0, 40)
      .map((item) => normalizeUrl(`${SITE_URL}${item.localUrl || ""}`))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function ensureIndexNowKeyFile() {
  await fs.writeFile(INDEXNOW_KEY_FILE, `${INDEXNOW_KEY}\n`, "utf8");
}

async function submitIndexNow(urlList) {
  if (urlList.length === 0) {
    console.log("indexnow skipped: empty url list");
    return;
  }

  const payload = {
    host: "www.librchain.com",
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList
  };

  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(`indexnow failed: ${response.status} ${text}`);
      return;
    }

    console.log(`indexnow ok: ${urlList.length} urls`);
  } catch (error) {
    console.warn(`indexnow error: ${error}`);
  }
}

async function pingBingSitemap() {
  const pingUrl = `https://www.bing.com/ping?sitemap=${encodeURIComponent(`${SITE_URL}/sitemap.xml`)}`;

  try {
    const response = await fetch(pingUrl, {
      method: "GET"
    });

    if (response.status === 410) {
      console.log("bing ping deprecated (410), relying on IndexNow submission");
      return;
    }

    console.log(`bing ping: ${response.status}`);
  } catch (error) {
    console.warn(`bing ping error: ${error}`);
  }
}

async function main() {
  await ensureIndexNowKeyFile();

  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/feed.xml`,
    `${SITE_URL}/sitemap.xml`,
    ...(await readNewsUrls())
  ];

  const deduped = [...new Set(urls)].slice(0, 100);

  await submitIndexNow(deduped);
  await pingBingSitemap();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
