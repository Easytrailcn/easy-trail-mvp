"""
EasyTrail 数据过滤配置
=========================

维护者在某医疗企业任职,主动排除与任职公司同类业务的试验数据。
本文件是数据同步 ETL 的过滤规则配置中心。
"""

# ============================================================
# 在职期间过滤项(EMPLOYMENT_FILTER)
# ============================================================
# 用途:避免与任职公司业务重叠,降低竞业/忠实义务/IP 风险
# 移除时机:维护者从相关公司离职后,可移除本过滤块
# 修改记录:在 CHANGELOG.md 中记录每次过滤规则的变更
# ============================================================

EMPLOYMENT_FILTER = {
    # 关键词黑名单(大小写不敏感,匹配试验标题/简介/干预措施)
    "exclude_keywords": [
        # TIL(肿瘤浸润淋巴细胞)相关
        "TIL",
        "tumor-infiltrating lymphocyte",
        "tumor infiltrating lymphocytes",
        "TIL therapy",
        "adoptive cell transfer",  # TIL 常用分类术语
        "adoptive T-cell therapy",
        "tumor infiltrating",
    ],

    # 申办方黑名单(精确匹配,可选)
    "exclude_sponsor": [
        # 例如: "Some Pharma Co., Ltd."
    ],

    # NCT 编号前缀黑名单(可选,极少使用)
    "exclude_nct_prefix": [],

    # 启用开关
    "enabled": True,

    # 移除日期(离职后填写)
    "removal_date": None,  # 例:"2027-01-01"
    "removal_reason": None,  # 例:"维护者从蓝马医疗离职"
}


def should_exclude_trial(trial: dict) -> bool:
    """
    判断一条试验是否需要被过滤掉

    参数:
        trial: 一条试验的字典数据(来自 ClinicalTrials.gov API)

    返回:
        True = 需要过滤(不入库)
        False = 保留
    """
    if not EMPLOYMENT_FILTER.get("enabled", False):
        return False

    # 1. 关键词黑名单检查
    keywords = EMPLOYMENT_FILTER.get("exclude_keywords", [])
    if keywords:
        text_fields = [
            trial.get("briefTitle", ""),
            trial.get("officialTitle", ""),
            trial.get("briefSummary", ""),
            trial.get("detailedDescription", ""),
        ]
        # 干预措施名称也参与匹配
        for intervention in trial.get("interventions", []) or []:
            text_fields.append(intervention.get("name", ""))
            text_fields.append(intervention.get("description", ""))

        combined = " ".join(text_fields).lower()
        for kw in keywords:
            if kw.lower() in combined:
                return True

    # 2. 申办方黑名单检查
    sponsor_blacklist = EMPLOYMENT_FILTER.get("exclude_sponsor", [])
    if sponsor_blacklist:
        sponsor = trial.get("leadSponsor", {}).get("name", "")
        if any(s.lower() in sponsor.lower() for s in sponsor_blacklist):
            return True

    # 3. NCT 编号前缀检查
    prefix_blacklist = EMPLOYMENT_FILTER.get("exclude_nct_prefix", [])
    if prefix_blacklist:
        nct_id = trial.get("protocolSection", {}).get("identificationModule", {}).get("nctId", "")
        if any(nct_id.startswith(p) for p in prefix_blacklist):
            return True

    return False


def get_filter_stats_template() -> dict:
    """
    返回过滤统计的初始结构(用于 sync_log 表)
    """
    return {
        "trials_fetched": 0,
        "trials_filtered": 0,
        "trials_inserted": 0,
        "trials_updated": 0,
        "trials_failed": 0,
    }


# ============================================================
# 其他过滤规则(可在未来扩展)
# ============================================================

# 例如: 排除已撤销的试验
QUALITY_FILTER = {
    "exclude_completed_older_than_years": None,  # 不限年龄
    "exclude_withdrawn": True,                    # 排除 WITHDRAWN 状态
    "exclude_terminated": False,                  # 保留 TERMINATED(可能有参考价值)
    "min_enrollment_count": 0,                    # 不限人数
}


# ============================================================
# 调试辅助
# ============================================================

if __name__ == "__main__":
    # 简单测试
    test_trial_1 = {
        "briefTitle": "TIL Therapy for Melanoma",
        "officialTitle": "Tumor-Infiltrating Lymphocyte Therapy Study",
        "briefSummary": "A study of TIL therapy",
    }
    test_trial_2 = {
        "briefTitle": "Pembrolizumab for Lung Cancer",
        "officialTitle": "Study of Anti-PD-1 in NSCLC",
        "briefSummary": "A phase 3 study",
    }

    print(f"TIL 试验是否过滤: {should_exclude_trial(test_trial_1)}")  # 期望: True
    print(f"PD-1 试验是否过滤: {should_exclude_trial(test_trial_2)}")  # 期望: False