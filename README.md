# librchain.com

一个部署在 Cloudflare Pages 的区块链新闻主题站点。

## 本地结构

- `public/`：静态页面资源
- `.github/workflows/deploy-pages.yml`：推送到 `main` 时自动部署到 Cloudflare Pages
- `wrangler.toml`：Cloudflare Pages 配置

## 自动同步部署（GitHub -> Cloudflare）

1. 在 Cloudflare 中创建 Pages 项目（项目名必须是 `librchain`）：
   ```bash
   wrangler pages project create librchain --production-branch main
   ```
2. 在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 添加：
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. 推送到 `main` 分支后，GitHub Actions 会自动发布到 Cloudflare Pages。
4. 在 Cloudflare Pages 的 `Custom domains` 里绑定 `librchain.com`。

## 本地预览

```bash
wrangler pages dev public
```
