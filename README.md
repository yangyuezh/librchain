# librchain.com

一个部署在 Cloudflare Pages 的区块链新闻主题站点。

## 本地结构

- `public/`：静态页面资源
- `.github/workflows/deploy-pages.yml`：推送到 `main` 时自动部署到 Cloudflare Pages
- `wrangler.toml`：Cloudflare Pages 配置

## 自动同步部署（GitHub -> Cloudflare）

已完成：

- GitHub 仓库：`https://github.com/yangyuezh/librchain`
- Cloudflare Pages 项目：`librchain`
- 自动部署工作流：推送到 `main` 分支后自动发布

当前保留的一步（域名生效）：

1. 在 Cloudflare DNS 中为 `librchain.com` 增加 CNAME 记录：
   - Name: `@`
   - Target: `librchain.pages.dev`
   - Proxy status: Proxied（橙云）
2. 等待证书签发完成后，`https://librchain.com` 即可直接访问。

## 本地预览

```bash
wrangler pages dev public
```
