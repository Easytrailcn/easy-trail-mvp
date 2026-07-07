-- ============================================================
-- EasyTrail 数据库 Schema v1.0
-- 数据库: Cloudflare D1 (SQLite 兼容)
-- 字符集: UTF-8
-- 最后更新: 2026-07-06
-- ============================================================

-- ============================================
-- 1. 试验主表
-- ============================================
CREATE TABLE IF NOT EXISTS trials (
    nct_id TEXT PRIMARY KEY,            -- NCT 编号(主键),例 NCT07444203
    brief_title TEXT NOT NULL,          -- 短标题(搜索用)
    official_title TEXT,                -- 官方全称
    brief_summary TEXT,                 -- 简介(搜索用)
    detailed_description TEXT,          -- 详细描述

    -- 核心筛选字段
    overall_status TEXT NOT NULL,       -- 招募状态:RECRUITING / ACTIVE_NOT_RECRUITING / NOT_YET_RECRUITING / COMPLETED / SUSPENDED / TERMINATED / WITHDRAWN
    conditions TEXT NOT NULL,           -- 癌种/疾病,JSON 数组字符串
    phases TEXT,                        -- 试验阶段,JSON 数组字符串
    study_type TEXT,                    -- 试验类型:INTERVENTIONAL / OBSERVATIONAL / EXPANDED_ACCESS
    lead_sponsor TEXT,                  -- 主办方/公司

    -- 入组条件
    eligibility_criteria TEXT,          -- 入组标准全文
    min_age TEXT,                       -- 最低年龄
    max_age TEXT,                       -- 最高年龄
    gender TEXT,                        -- 性别限制:ALL / MALE / FEMALE

    -- 干预措施(冗余存储,便于筛选)
    intervention_names TEXT,            -- 干预措施名称,JSON 数组字符串
    intervention_types TEXT,            -- 干预类型,JSON 数组字符串

    -- 时间与规模
    enrollment_count INTEGER,           -- 招募人数
    enrollment_type TEXT,               -- 招募类型(实际/预期)
    start_date TEXT,                    -- 开始日期
    completion_date TEXT,               -- 完成日期
    primary_completion_date TEXT,       -- 主要终点完成日期
    last_update_date TEXT NOT NULL,     -- 数据更新时间(增量同步用)

    -- 链接
    source_url TEXT NOT NULL,           -- ClinicalTrials.gov 官方链接

    -- 元数据
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- 2. 试验地点表(一对多)
-- ============================================
CREATE TABLE IF NOT EXISTS trial_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nct_id TEXT NOT NULL,               -- 关联主表
    facility TEXT,                      -- 医院/机构名
    city TEXT,                          -- 城市
    state TEXT,                         -- 省/州
    country TEXT,                       -- 国家
    status TEXT,                        -- 该地点的招募状态
    FOREIGN KEY (nct_id) REFERENCES trials(nct_id) ON DELETE CASCADE
);

-- ============================================
-- 3. 同步日志表(运维用)
-- ============================================
CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_time TEXT DEFAULT (datetime('now')),
    sync_mode TEXT,                     -- full / incremental / test
    trials_fetched INTEGER,             -- API 抓取条数
    trials_filtered INTEGER,            -- 黑名单过滤条数
    trials_inserted INTEGER,            -- 新增条数
    trials_updated INTEGER,             -- 更新条数
    trials_failed INTEGER,              -- 失败条数
    duration_seconds REAL,              -- 同步耗时
    status TEXT,                        -- success / failed / partial
    error_message TEXT                  -- 错误信息(若有)
);

-- ============================================
-- 4. 索引(查询加速)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_trials_status ON trials(overall_status);
CREATE INDEX IF NOT EXISTS idx_trials_phase ON trials(phases);
CREATE INDEX IF NOT EXISTS idx_trials_last_update ON trials(last_update_date DESC);
CREATE INDEX IF NOT EXISTS idx_trials_sponsor ON trials(lead_sponsor);
CREATE INDEX IF NOT EXISTS idx_trials_study_type ON trials(study_type);

CREATE INDEX IF NOT EXISTS idx_locations_nct ON trial_locations(nct_id);
CREATE INDEX IF NOT EXISTS idx_locations_country ON trial_locations(country);
CREATE INDEX IF NOT EXISTS idx_locations_status ON trial_locations(status);

CREATE INDEX IF NOT EXISTS idx_sync_log_time ON sync_log(sync_time DESC);

-- ============================================
-- 5. 全文搜索支持(SQLite FTS5 虚拟表)
-- ============================================
-- 用于搜索 brief_title / brief_summary / conditions / lead_sponsor
CREATE VIRTUAL TABLE IF NOT EXISTS trials_fts USING fts5(
    nct_id UNINDEXED,
    brief_title,
    brief_summary,
    conditions,
    lead_sponsor,
    content='trials',
    content_rowid='rowid'
);

-- 触发器:trials 表插入/更新时同步到 FTS 表
CREATE TRIGGER IF NOT EXISTS trials_ai AFTER INSERT ON trials BEGIN
    INSERT INTO trials_fts(rowid, nct_id, brief_title, brief_summary, conditions, lead_sponsor)
    VALUES (new.rowid, new.nct_id, new.brief_title, new.brief_summary, new.conditions, new.lead_sponsor);
END;

CREATE TRIGGER IF NOT EXISTS trials_ad AFTER DELETE ON trials BEGIN
    INSERT INTO trials_fts(trials_fts, rowid, nct_id, brief_title, brief_summary, conditions, lead_sponsor)
    VALUES('delete', old.rowid, old.nct_id, old.brief_title, old.brief_summary, old.conditions, old.lead_sponsor);
END;

CREATE TRIGGER IF NOT EXISTS trials_au AFTER UPDATE ON trials BEGIN
    INSERT INTO trials_fts(trials_fts, rowid, nct_id, brief_title, brief_summary, conditions, lead_sponsor)
    VALUES('delete', old.rowid, old.nct_id, old.brief_title, old.brief_summary, old.conditions, old.lead_sponsor);
    INSERT INTO trials_fts(rowid, nct_id, brief_title, brief_summary, conditions, lead_sponsor)
    VALUES (new.rowid, new.nct_id, new.brief_title, new.brief_summary, new.conditions, new.lead_sponsor);
END;

-- ============================================================
-- 6. 视图(常用查询封装)
-- ============================================================

-- 试验 + 地点数量汇总(列表页用)
CREATE VIEW IF NOT EXISTS v_trials_with_location_count AS
SELECT
    t.*,
    (SELECT COUNT(*) FROM trial_locations WHERE nct_id = t.nct_id) AS location_count,
    (SELECT COUNT(DISTINCT country) FROM trial_locations WHERE nct_id = t.nct_id) AS country_count
FROM trials t;

-- 在招试验视图(默认列表)
CREATE VIEW IF NOT EXISTS v_active_trials AS
SELECT * FROM v_trials_with_location_count
WHERE overall_status IN ('RECRUITING', 'ACTIVE_NOT_RECRUITING', 'NOT_YET_RECRUITING');

-- ============================================================
-- 7. 数据完整性检查
-- ============================================================

-- 检查:不允许 nct_id 为空
-- 检查:overall_status 必须是已知值
-- 检查:source_url 必须是有效 URL

-- ============================================================
-- Schema 结束
-- ============================================================