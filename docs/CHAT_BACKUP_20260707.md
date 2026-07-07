# EasyTrail 项目对话备存

> 备份时间:2026-07-07
> 来源:Mavis(Richard 的 AI 助手)对话历史整理
> 用途:防止对话丢失,关键决策随时可查

---

## 第一部分:项目背景

### 用户身份
- **称呼**:Richard
- **公司**:苏州蓝马医疗技术有限公司
- **职位**:市场运营总监
- **公司 II 期产品**:TIL(肿瘤浸润淋巴细胞,CGT/细胞与基因治疗)
- **编程经验**:零基础,纯小白
- **工作设备**:主要在家庭电脑工作,公司电脑仅下达指令
- **联系方式**:QQ 邮箱 `11506127@qq.com`

### EasyTrail 项目
- **目标**:癌症患者及家属快速查询临床试验的轻量级检索工具
- **产品形态**:Web(Phase 1)+ 微信小程序(Phase 2)
- **法律定位**:信息检索工具,不是诊疗服务
- **目标用户**:癌症患者、家属、临床医生助理
- **开源协议**:MIT

---

## 第二部分:核心合规底线(🚨 硬性约束)

### 严禁触碰
1. ❌ 公司 II 期 TIL 试验的任何数据、方案、化合物、患者队列
2. ❌ 公司 CRM / 患者数据库
3. ❌ 公司内部沟通中获得的、未公开的临床试验设计思路
4. ❌ 在公司电脑/云盘/AI 工具上做任何 EasyTrail 相关工作
5. ❌ "推荐/适合/建议参与"等措辞出现在文案中
6. ❌ 个性化推荐 / 患者匹配评分 / 病历解读 / 在线问诊

### 必须有的合规元素
- ✅ 顶部固定 banner:"本工具仅提供临床试验信息查询,不构成医疗建议"
- ✅ 用户协议(medical disclaimer)
- ✅ 隐私政策(明示不收集用户信息)
- ✅ ETL 阶段过滤任职公司同类业务数据(TIL 黑名单)

---

## 第三部分:数据策略

### 数据源(分阶段)
- **Phase 1(当前)**:ClinicalTrials.gov(美国国立医学图书馆公开数据库)
  - 27 万+ 条试验,免费 API,JSON 格式,无需注册
  - 关键词:neoplasm OR cancer OR tumor OR carcinoma OR malignancy
- **Phase 2(后续)**:CDE 中国药物临床试验登记平台
  - 1.5 万+ 条,需爬虫,反爬严格,**需律师确认合规**
- **Phase 3(后续)**:企业官网 + 微信公众号
  - 非结构化数据,NLP 抽取,合规复杂

### 疾病范围
- **大类**:恶性肿瘤(全癌种)
- **优先深耕 5-6 个癌种**(国内高发):
  - 肺癌、肝癌、乳腺癌、胃癌、结直肠癌、白血病/淋巴瘤

### 数据存储(Cloudflare D1,SQLite 兼容)
- 主表 `trials`:试验核心信息(NCT ID、标题、状态、癌种、阶段、入组标准等)
- 一对多表 `trial_locations`:试验地点(医院、城市、国家)
- 同步日志表 `sync_log`:每次同步结果
- FTS5 全文搜索虚拟表 `trials_fts`:关键词搜索优化
- 视图 `v_active_trials`:在招试验汇总

### 同步策略
- **频率**:每 6 小时(GitHub Actions cron)
- **首次**:全量同步
- **后续**:增量同步(只拉 last_update > 上次同步时间)
- **写入**:用 ON CONFLICT 做 UPSERT

---

## 第四部分:技术架构

### 技术栈全家桶
| 层 | 技术 | 原因 |
|---|---|---|
| 前端 | 原生 HTML/CSS/JS | 零构建,快速部署 |
| 后端 | Cloudflare Workers | 免费,全球边缘,毫秒级响应 |
| 数据库 | Cloudflare D1(SQLite)| 与 Workers 配套,免费 10GB |
| 托管 | Cloudflare Pages | 免费静态托管,自动 HTTPS |
| 数据同步 | GitHub Actions | 免费,cron 调度,与代码同仓库 |
| 数据源 | ClinicalTrials.gov v2 API | 公开、免费、JSON 友好 |

### 项目目录结构
```
EasyTrail/
├── README.md
├── CHANGELOG.md
├── LICENSE (MIT)
├── .gitignore
├── docs/
│   ├── PROJECT_STATUS.md
│   ├── COMPLIANCE.md
│   └── CHAT_BACKUP_20260707.md (本文件)
├── db/
│   └── schema.sql (含 TIL 黑名单配置、FTS5、视图、触发器)
├── etl/
│   ├── config/
│   │   ├── filters.py (TIL 关键词黑名单)
│   │   └── settings.py
│   ├── fetch_trials.py (ClinicalTrials.gov API 拉取)
│   ├── transform.py (数据清洗)
│   ├── load.py (写入 D1,UPSERT)
│   ├── sync.py (主入口,GitHub Actions 调用)
│   └── requirements.txt
├── api/
│   └── workers/
│       ├── src/
│       │   ├── index.js
│       │   └── router.js (7 个 API 接口)
│       ├── wrangler.toml
│       └── package.json
├── frontend/
│   ├── index.html (首页 + 搜索)
│   ├── search.html (搜索结果页)
│   ├── trial.html (试验详情页)
│   ├── css/ (style, banner, search, trial, legal)
│   ├── js/ (config, api, index, search, trial)
│   └── legal/
│       ├── user-agreement.html
│       └── privacy-policy.html
├── legal/
│   └── banner.md (禁用措辞清单)
└── .github/
    └── workflows/
        └── sync-trials.yml (每 6 小时同步)
```

---

## 第五部分:关键决策汇总

### 决策 1:TIL 数据处理(2026-07-06)
- **最终**:走**路径 A**——EasyTrail 保持纯个人项目,ETL 脚本里加 TIL 黑名单
- **离职后再补**:用户原话「后续等我离职后再补充 TIL 的相关信息」
- **实现**:`etl/config/filters.py` 中 `EMPLOYMENT_FILTER.exclude_keywords` 包含:
  - "TIL"
  - "tumor-infiltrating lymphocyte"
  - "tumor infiltrating lymphocytes"
  - "TIL therapy"
  - "adoptive cell transfer"
  - "adoptive T-cell therapy"
  - "tumor infiltrating"
- **理由**:
  1. 避免与任职公司 TIL 业务的忠实义务/竞业争议
  2. 个人项目保持 IP 清晰,后续可创业/融资
  3. TIL 占肿瘤试验比例小(<2%),对产品价值几乎无影响
  4. README 写明"主动避嫌"反而是亮点

### 决策 2:用户身份策略(2026-07-06)
- **MVP 阶段**:完全匿名,无注册无登录
- **微信登录**:MVP 不引入,后期视情况评估
- **替代方案**:浏览器 localStorage 存收藏、URL 编码分享清单、公众号菜单跳转

### 决策 3:数据源策略(2026-07-06)
- **Phase 1**:仅 ClinicalTrials.gov
- **CDE/公众号**:后续合规方案确定后再接入
- **三源融合**:Phase 2 才考虑

### 决策 4:Git 托管策略(2026-07-07)
- **方案 B**:GitHub 主用 + Gitee 镜像(国内访问友好)
- **理由**:长远看 B 更好(团队化、国际化、融资、招人都看 GitHub)
- **现状**:Richard 已注册 GitHub 账号 `easytrailcn`,仓库 `easy-trail-mvp` 已创建

### 决策 5:名字策略(2026-07-06)
- **项目代号**:EasyTrail(暂定)
- **候选**:EasyTrail / 寻试 / 试迹 / 科林查询 / FindTrial / TrialFinder / ClinicalHub
- **Mavis 推荐**:中文「寻试」+ 英文「EasyTrail」

### 决策 6:部署架构(2026-07-06)
- **Cloudflare 全家桶**:Pages(前端)+ Workers(API)+ D1(数据库)
- **国内访问**:MVP 暂不优化,等用户反馈再加腾讯云 CDN
- **域名**:待定(easytrail.cn / easytrail.com / xunshi.cn 等)

---

## 第六部分:API 设计

### 7 个接口(Workers + D1)
| 路径 | 方法 | 功能 |
|---|---|---|
| `/api/health` | GET | 健康检查,返回数据库统计 |
| `/api/stats` | GET | 数据统计(总试验数、在招数、地点数、上次同步) |
| `/api/trials` | GET | 搜索(q/condition/phase/status/country + limit/offset) |
| `/api/trials/:nct_id` | GET | 单条试验详情(含 locations) |
| `/api/trials/:nct_id/locations` | GET | 试验地点列表 |
| `/api/facets` | GET | 筛选维度可选值 |

### 搜索参数示例
```
GET /api/trials?q=肺癌&phase=PHASE3&status=RECRUITING&country=China&limit=50&offset=0
```

---

## 第七部分:GitHub 账号与仓库

### Richard GitHub 信息
- **用户名**:`easytrailcn`(注册时 easytrail 被占用,改为 easytrailcn)
- **邮箱**:`11506127@qq.com`
- **仓库**:`easy-trail-mvp`
- **仓库 URL**:`https://github.com/Easytrailcn/easy-trail-mvp.git`
- **可见性**:Public
- **许可**:MIT
- **.gitignore**:Node

### GitHub 状态
- ✅ 账号注册成功
- ✅ 邮箱验证完成
- ✅ 仓库 easy-trail-mvp 创建完成
- ⏳ 待办:生成 SSH Key、配 git remote、第一次 push

---

## 第八部分:7 天 MVP 路线图

| Day | 任务 | 状态 |
|---|---|---|
| Day 1 | 项目骨架 + 文档 + 合规文案 + schema + ETL + API + 前端 | ✅ 完成 |
| Day 2 | 注册账号(GitHub ✅, Cloudflare ⏳) + 域名 + 名字定案 | 🟡 进行中 |
| Day 3 | Cloudflare 建 D1 + 执行 schema.sql + ETL 本地测试 | ⏳ 待办 |
| Day 4 | GitHub Actions 自动化同步上线 + Secrets 配置 | ⏳ 待办 |
| Day 5 | 前端页面完善 + 响应式适配 | ⏳ 待办 |
| Day 6 | Workers API 联调 + 合规文案最终审查 | ⏳ 待办 |
| Day 7 | 部署 Cloudflare Pages + 绑域名 + HTTPS + 公众号菜单 | ⏳ 待办 |

---

## 第九部分:后续 Phase 路线

### Phase 2(1-3 个月)
- 招一个兼职前端开发者
- 接入 CDE 数据(律师确认合规后)
- 前端界面精细化

### Phase 3(3-6 个月)
- 加入企业公众号信息
- 招数据工程师
- 完善 ETL 流程

### 长期
- 用户量起来后考虑微信小程序
- 招技术合伙人或全职开发
- 融资 / 商业化探索(给药企 / CRO 推广引流)

---

## 第十部分:Richard 的资源清单

| 资源 | 状态 | 备注 |
|---|---|---|
| 个人 GitHub | ✅ 已注册 | 用户名 easytrailcn |
| 个人 Cloudflare | ⏳ 待注册 | 需拿到 Account ID + API Token + D1 Database ID |
| 微信个人公众号 | ⏳ 待注册 | 个人主体订阅号 |
| 个人域名 | ⏳ 待查重注册 | 候选:easytrail.cn / easytrail.com |
| 个人邮箱 | ✅ 已用 | 11506127@qq.com |
| GitHub 仓库 | ✅ 已创建 | easy-trail-mvp |
| 本地项目目录 | ✅ 已建 | G:\EasyTrail\ |

---

## 第十一部分:POCKET 与跨端流转

### Pocket 是什么(2026-04-14 Beta 上线)
- MiniMax Agent 桌面端的 IM 集成功能
- 在飞书/微信/企微/Slack 中 @ Agent 触发任务
- 任务在云端执行,结果推回 IM

### Pocket 与 Mavis 的区别
- **Pocket** = 入口形态(IM 触发)
- **Mavis** = 工作台(详细任务处理)

### 三种使用模式
1. **反向同步**:Pocket @ Agent「打开我的仓库,看今天加了什么」— 通勤时了解进度
2. **任务接力**:Pocket @ Agent「让 Mavis 继续昨天的任务」— 跨设备继续
3. **进度推送**:Mavis 完成大任务后自动推送到 Pocket

### 落地步骤
1. MiniMax Agent 网页端登录,确认 Token Plan 已绑定
2. 飞书搜索「MiniMax Agent」小程序,绑定同一 MiniMax 账号
3. 测试一次「你好」确认 Pocket 能跟 Agent 对话
4. 配置 IM 触发 + 任务推送

---

## 第十二部分:风险与缓解

| 风险 | 等级 | 缓解措施 |
|---|---|---|
| 法律-商业秘密 | 🟢 低 | 严格执行个人电脑 + 个人账号 + 零公司落地 |
| 法律-竞业 | 🟢 低 | 产品定位明确「通用工具」,不涉及公司业务 |
| 法律-患者隐私 | 🟢 低 | MVP 不收集任何用户输入历史 |
| 法律-医疗建议 | 🟢 低 | 顶部 banner + 用户协议 + 文案审查 |
| 技术-国内访问 | 🟡 中 | MVP 暂不优化,后期加腾讯云 CDN |
| 技术-数据质量 | 🟡 中 | 数据清洗层 + 容错 |
| IP-代码归属 | 🟢 低 | 保留开发日志 + 时间戳证据(GitHub commit) |
| GitHub 国内访问 | 🟡 中 | Gitee 镜像 + 加速工具(Watt Toolkit 等) |

---

## 第十三部分:当下 Richard 关心的事

### 1. Pocket 是否能本地运行
**答案**:
- Pocket 不是"在本地跑 AI",而是通过 IM 触发 AI 任务
- AI(Mavis/MiniMax Agent)跑在云端,你的电脑通过 MiniMax Code 这个工作台跟云端连接
- 你在微信/飞书里 @ Agent → 云端 AI 处理 → 结果推回 IM
- 同时,MiniMax Code 已经有 Computer Use 能力,可以操作你电脑桌面

### 2. 类似 OpenClaw 的体验
- OpenClaw 是 MiniMax Code 的竞品/类似产品
- MiniMax Code 已经能做到:手机 IM 发指令 → 电脑端自动跑命令、操作桌面、推回结果
- 这跟 Richard 想要的"手机控制电脑"是吻合的

### 3. 后续 Richard 的使用模式
- 通勤路上用微信/飞书给指令
- 让 Mavis 在家庭电脑上跑命令(PowerShell、Git 操作、文件编辑)
- Mavis 把结果截图或文本推回手机
- Richard 回到家用电脑,所有中间产物都已落地

---

## 第十四部分:接下来 Richard 要做的事(按优先级)

### 立即(今天)
1. 验证 git 是否安装(`git --version`)
2. 如未装,我给安装命令
3. 生成 SSH Key,我给命令
4. 公钥贴到 GitHub Settings
5. 第一次 push 把 G:\EasyTrail 全部推上去

### 这周
1. 注册 Cloudflare 账号
2. 注册微信公众号(订阅号)
3. 查重 + 注册域名

### 下周
1. Cloudflare 建 D1 + 跑 schema.sql
2. ETL 本地测试一次
3. GitHub Actions 配置 Secrets

---

## 第十五部分:紧急联系 / 备忘

### 紧急备忘
- **不要用公司邮箱/账号做任何 EasyTrail 相关事**
- **不要在公司电脑上碰 EasyTrail 文件**
- **TIL 黑名单不要移除**(除非已离职)
- **不要在文案里出现"推荐/适合/建议"**
- **顶部 banner 必须有**

### 重要密码/凭据(建议 Richard 自己保管)
- GitHub 密码
- Cloudflare 密码(待注册)
- QQ 邮箱 11506127@qq.com 密码

---

**文档结束**

如需更新此备存,请联系 Mavis(Mavis 会自动重新整理)。