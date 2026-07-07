# Changelog

所有重要的项目变更都会记录在此文件。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

### 计划中
- 前端搜索页面开发 (Day 5)
- Workers API 搜索接口 (Day 6)
- 部署上线到 Cloudflare Pages (Day 7)

## [0.1.0] - 2026-07-06

### Added
- 项目骨架初始化
- README.md 项目说明
- 数据库 schema.sql 草案(Cloudflare D1)
- ETL 数据同步脚本骨架(ClinicalTrials.gov v2 API)
- Cloudflare Workers API 骨架
- 前端 HTML 骨架(首页 + 搜索页 + 详情页)
- 合规文案(顶部 banner + 用户协议 + 隐私政策)
- TIL 黑名单过滤机制(`etl/config/filters.py`)
- GitHub Actions 定时同步配置
- 项目文档(状态说明 + 合规说明)

### 设计决策
- **数据源策略**: Phase 1 仅使用 ClinicalTrials.gov;CDE 和企业公众号后续合规方案确定后再接入
- **疾病范围**: 恶性肿瘤大类,优先深耕 5-6 个高发癌种
- **用户身份**: MVP 阶段完全匿名,无注册无登录
- **微信登录**: MVP 不引入,后期视情况再评估
- **TIL 处理**: 在职期间主动过滤同类业务试验,离职后移除过滤
- **免费初心**: 面向患者的工具永久免费

### 法律声明
- 工具性质: 信息查询工具,非诊疗服务
- 顶部固定合规 banner: 必显示
- 用户协议 + 隐私政策: 必显示且可访问
- 数据采集: 仅拉取 ClinicalTrials.gov 公开 API 数据,不收集任何用户身份信息