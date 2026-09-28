# Hotel Quiz Platform (static deploy)

丽思卡尔顿刷题平台 - 纯静态站托管（GitHub Pages）。

- `index.html` - 全部前端（学员端 + 管理端，单文件）
- `assets/logo.webp` - 站点 logo
- `.nojekyll` - 禁用 Jekyll 处理，原样发布

## 数据后端

本站为纯静态站，所有数据（题库/试卷/评分/学员快照/账户）通过 Supabase REST API 读写，与本仓库无关。

## 更新流程

1. 修改本地权威源 `eopages_deploy/index.html`
2. 复制到本目录：`cp eopages_deploy/index.html .`
3. `git add -A && git commit -m "描述" && git push`
4. 约 1-2 分钟后 GitHub Pages 生效

注意：Pages 地址为 `https://<用户名>.github.io/<仓库名>/`，是子路径部署。
本站资源引用均为相对路径（`assets/logo.webp`），子路径下可正常工作。
