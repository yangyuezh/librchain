# librchain.com

部署在 Cloudflare Pages 的区块链新闻聚合站，支持每小时自动抓取新闻并自动发布。

## 现在的站点结构

- `public/index.html`：首页
- `public/app.js`：前端渲染逻辑（读取 `news.json`）
- `public/news.json`：自动生成的新闻数据
- `public/news/*.html`：自动生成的可索引新闻详情页
- `public/feed.xml`：站点 RSS
- `public/sitemap.xml`：站点 sitemap
- `public/robots.txt`：搜索引擎抓取规则

## 自动化工作流

- `.github/workflows/hourly-news.yml`
  - 每小时第 8 分钟执行：抓取新闻/博客/X 相关新闻
  - 自动生成 `news.json`、`news/*.html`、`feed.xml`、`sitemap.xml`、`robots.txt`
  - 有变更时自动 commit + push（触发 Cloudflare Pages 自动部署）

- `.github/workflows/deploy-pages.yml`
  - `main` 分支有新提交时自动部署到 Cloudflare Pages

- `.github/workflows/seo-promotion.yml`
  - 每小时第 38 分钟执行 SEO 推送
  - 提交 IndexNow URL 列表并执行 sitemap ping

## 数据与 SEO 脚本

- `scripts/update-news.mjs`：抓取源数据并生成站点内容资产
- `scripts/seo-promote.mjs`：向搜索引擎提交最新 URL

## 本地手动执行

```bash
npm run update:news
npm run seo:promote
```

## 当前域名分配

- `www.librchain.com` -> Cloudflare Pages（新闻站）
- `librchain.com` -> 你的 VPS（保留原业务）
