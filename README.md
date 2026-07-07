# EasyTrail

> 一个轻量、免费、专注查询的临床试验检索工具。
> 帮助癌症患者及家属快速找到可参与的临床试验。

## 项目状态

- **当前阶段**: MVP 开发中 (Day 1)
- **目标上线**: 7 天 MVP
- **数据源**: ClinicalTrials.gov (Phase 1)
- **法律定位**: 信息查询工具，非诊疗服务
- **维护者**: 个人独立项目 (与任职公司业务严格隔离)

## 核心原则

1. **只查询,不做诊疗** — 工具不提供医疗建议,所有内容仅供信息查询
2. **零用户数据** — 不收集用户身份、不存储搜索历史、不使用追踪工具
3. **公开数据源** — 仅使用 ClinicalTrials.gov 等公开 API
4. **完全免费** — 面向患者的工具,不收取任何费用
5. **在职避嫌** — 维护者在某医疗企业任职,主动排除与任职公司同类业务的试验数据

## 项目结构

```
EasyTrail/
├── README.md              # 项目介绍(本文件)
├── CHANGELOG.md           # 版本变更记录
├── LICENSE                # 开源协议
├── .gitignore             # Git 忽略文件
├── docs/                  # 项目文档
│   ├── PROJECT_STATUS.md  # 项目状态与路线
│   └── COMPLIANCE.md      # 合规说明
├── db/                    # 数据库
│   └── schema.sql         # D1 数据库建表脚本
├── etl/                   # 数据同步
│   ├── config/
│   │   └── filters.py     # 过滤配置(TIL 黑名单等)
│   ├── fetch_trials.py    # 从 ClinicalTrials.gov 拉数据
│   ├── transform.py       # 数据清洗与转换
│   ├── load.py            # 写入 D1 数据库
│   └── sync.py            # 主入口(由 GitHub Actions 调度)
├── api/                   # 后端 API
│   └── workers/           # Cloudflare Workers
│       ├── src/
│       │   ├── index.js   # 入口
│       │   └── router.js  # 路由
│       ├── wrangler.toml  # Cloudflare 配置
│       └── package.json
├── frontend/              # 前端
│   ├── index.html         # 首页
│   ├── search.html        # 搜索结果页
│   ├── trial.html         # 试验详情页
│   ├── css/
│   ├── js/
│   └── assets/
├── legal/                 # 合规文案
│   ├── banner.md          # 顶部固定 banner
│   ├── user-agreement.md  # 用户协议
│   └── privacy-policy.md  # 隐私政策
└── .github/
    └── workflows/
        └── sync-trials.yml # 定时同步任务
```

## 技术栈

| 层 | 技术 | 原因 |
|---|---|---|
| 前端 | 原生 HTML/CSS/JS | 零构建、快速部署 |
| 后端 | Cloudflare Workers | 免费、全球边缘、毫秒级响应 |
| 数据库 | Cloudflare D1 (SQLite) | 与 Workers 配套,免费 10GB |
| 托管 | Cloudflare Pages | 免费静态托管,自动 HTTPS |
| 数据同步 | GitHub Actions | 免费、cron 调度、与代码同仓库 |
| 数据源 | ClinicalTrials.gov v2 API | 公开、免费、JSON 友好 |

## 快速开始

### 本地开发

```bash
# 1. 安装依赖(仅 ETL 和 Workers 需要)
pip install requests    # ETL 数据抓取
npm install             # Workers API

# 2. 本地拉一次数据(可选,数据已托管在云端)
python etl/sync.py --mode=test

# 3. 本地启动 Workers
cd api/workers
npx wrangler dev

# 4. 本地预览前端
cd frontend
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```

### 部署上线

详见 [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) 部署章节。

## 路线图

- **Day 1**: 项目骨架 + 文档 + 合规文案 ✅
- **Day 2**: 注册账号 + 域名准备
- **Day 3**: 数据库建库 + ETL 同步脚本
- **Day 4**: GitHub Actions 自动化同步
- **Day 5**: 前端页面开发
- **Day 6**: Workers API + 搜索功能
- **Day 7**: 部署上线 + 公众号菜单 + 第一份 CHANGELOG

后续:
- **Phase 2**: 加入 CDE 国内数据(待合规方案确定)
- **Phase 3**: 加入企业公众号信息(待合规方案确定)
- **维护者离职后**: 移除 TIL 黑名单过滤,纳入更多试验数据

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 联系方式

通过项目 GitHub Issues 提交反馈。