# EasyTrail 项目状态

> 最后更新:2026-07-06

## 当前阶段

**Day 1 完成** — 项目骨架、数据库 schema、ETL 脚本、Workers API、前端页面、合规文案全部就绪。

## 已完成 ✅

- [x] 项目目录结构
- [x] README / CHANGELOG / .gitignore / LICENSE
- [x] 数据库 schema.sql(含 FTS5 全文搜索、视图、触发器)
- [x] ETL 数据同步脚本(fetch / transform / load / sync + TIL 黑名单过滤)
- [x] Cloudflare Workers API(健康检查、搜索、详情、统计、筛选维度)
- [x] 前端骨架(首页 + 搜索页 + 详情页 + 用户协议 + 隐私政策)
- [x] 合规文案(banner + 禁用措辞清单)
- [x] GitHub Actions 定时同步配置

## 待完成 ⏳

### Day 2 — 注册账号 + 域名准备

- [ ] 注册个人 GitHub 账号
- [ ] 注册个人 Cloudflare 账号
- [ ] APP 名字定案(候选:EasyTrail / 寻试 / 试迹)
- [ ] 查重商标 + 域名
- [ ] 注册域名(暂定:easytrail.cn 或 easy-trail.app)

### Day 3 — 数据库建库 + ETL 初始化

- [ ] Cloudflare 创建 D1 数据库
- [ ] 执行 schema.sql 初始化表结构
- [ ] ETL 本地测试一次(fetch 5 条 + 写入本地 SQLite)
- [ ] 准备 Cloudflare API Token

### Day 4 — 自动化同步上线

- [ ] 推送代码到 GitHub
- [ ] 配置 GitHub Secrets(CF_ACCOUNT_ID / CF_D1_DATABASE_ID / CF_API_TOKEN)
- [ ] 触发第一次手动同步
- [ ] 验证数据成功入库
- [ ] 设置定时同步(每 6 小时)

### Day 5 — 前端页面完善

- [ ] 首页样式细节调整
- [ ] 搜索页 + 详情页真实数据接入测试
- [ ] 移动端响应式适配

### Day 6 — API 联调

- [ ] 部署 Workers 到 Cloudflare
- [ ] 联调前端 → Workers → D1 整条链路
- [ ] 合规文案最终审查

### Day 7 — 上线发布

- [ ] 部署前端到 Cloudflare Pages
- [ ] 绑定自定义域名
- [ ] 配置 HTTPS
- [ ] 微信公众号菜单配置
- [ ] 写第一份 CHANGELOG 发布日志
- [ ] 分享给医生朋友体验

## 部署清单

### Cloudflare 资源

| 资源 | 用途 | 计划 |
|---|---|---|
| Pages | 前端静态托管 | 免费版 |
| Workers | API 服务 | 免费版(10 万请求/天) |
| D1 | 数据库 | 免费版(10GB) |

### GitHub 仓库

- 仓库名:`easy-trail-mvp`
- 可见性:Public(时间戳证据)
- 主要分支:`main`

### 域名

- 首选:easytrail.cn(待查重)
- 备选:easytrail.app / easy-trail.cn
- 注册商:腾讯云 / 阿里云(国内)
- 备案:需要(7-20 天)

### Secrets 配置

需要在 GitHub 仓库配置以下 Secrets:
- `CF_ACCOUNT_ID`: Cloudflare 账户 ID
- `CF_D1_DATABASE_ID`: D1 数据库 ID
- `CF_API_TOKEN`: Cloudflare API Token

## 风险与合规

### 已规避风险

1. **TIL 数据过滤** — ETL 脚本自动过滤与任职公司同类业务,避免竞业/IP 风险
2. **不收集用户信息** — 工具不收集、不存储任何用户身份或健康数据
3. **不提供医疗建议** — 所有页面顶部 banner 强制显示免责声明
4. **完全匿名使用** — 无需注册、无需登录

### 待评估风险

1. **国内访问速度** — Cloudflare 在国内较慢,可后续加腾讯云 CDN
2. **微信小程序接入** — 个人主体可做小程序但功能受限,后续视情况决定
3. **CDE 数据接入** — 国内数据需爬虫,合规成本高,待 Phase 2 评估

## 关键决策记录

### 2026-07-06
- **决策**: TIL 在职期间排除,离职后移除过滤
- **决策**: MVP 阶段纯匿名,无注册无登录
- **决策**: 微信登录 MVP 不引入,后期再说
- **决策**: 数据源 Phase 1 仅用 ClinicalTrials.gov
- **决策**: 部署架构用 Cloudflare 全家桶(Pages + Workers + D1)

## 下一步具体动作

**给维护者(Richard)的清单**:

1. 决定 APP 名字(候选中选一个)
2. 注册个人 GitHub 账号
3. 注册个人 Cloudflare 账号
4. 查重域名可用性
5. 准备 Cloudflare API Token(给 ETL 用)

完成后告诉 Mavis,后续代码/配置都可以一键到位。