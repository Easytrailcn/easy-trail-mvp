"""
EasyTrail ETL: 试验数据清洗与转换
==================================

将 ClinicalTrials.gov v2 API 的原始 JSON 数据转换为 EasyTrail 数据库 schema 格式。
"""

import json
from typing import Optional


def transform_trial(raw: dict) -> Optional[dict]:
    """
    转换一条试验数据为数据库插入格式

    参数:
        raw: ClinicalTrials.gov API 返回的原始试验数据

    返回:
        转换后的字典(可直接用于 SQL INSERT)
        None 表示数据不完整,跳过
    """
    try:
        ps = raw.get("protocolSection", {})
        idm = ps.get("identificationModule", {})
        stm = ps.get("statusModule", {})
        com = ps.get("conditionsModule", {})
        spm = ps.get("sponsorCollaboratorsModule", {})
        elm = ps.get("eligibilityModule", {})
        dsm = ps.get("designModule", {})
        aim = ps.get("armsInterventionsModule", {})
        loc = ps.get("contactsLocationsModule", {})

        nct_id = idm.get("nctId")
        if not nct_id:
            return None

        # 提取所有地点(用于 trial_locations 表)
        locations = []
        for loc_item in loc.get("locations", []) or []:
            locations.append({
                "facility": loc_item.get("facility"),
                "city": loc_item.get("city"),
                "state": loc_item.get("state"),
                "country": loc_item.get("country"),
                "status": loc_item.get("status"),
            })

        # 干预措施
        interventions = aim.get("interventions", []) or []
        intervention_names = [i.get("name") for i in interventions if i.get("name")]
        intervention_types = [i.get("type") for i in interventions if i.get("type")]

        # 转换后的主表数据
        return {
            # 主键
            "nct_id": nct_id,

            # 标题与描述
            "brief_title": idm.get("briefTitle", ""),
            "official_title": idm.get("officialTitle", ""),
            "brief_summary": idm.get("descriptionModule", {}).get("briefSummary", ""),  # 注意层级
            "detailed_description": idm.get("descriptionModule", {}).get("detailedDescription", ""),

            # 核心筛选字段
            "overall_status": stm.get("overallStatus", "UNKNOWN"),
            "conditions": json.dumps(com.get("conditions", []), ensure_ascii=False),
            "phases": json.dumps(dsm.get("phases", []) or ["NA"], ensure_ascii=False),
            "study_type": dsm.get("studyType", ""),
            "lead_sponsor": spm.get("leadSponsor", {}).get("name", ""),

            # 入组条件
            "eligibility_criteria": elm.get("eligibilityCriteria", ""),
            "min_age": elm.get("minimumAge", ""),
            "max_age": elm.get("maximumAge", ""),
            "gender": elm.get("sex", "ALL"),

            # 干预措施
            "intervention_names": json.dumps(intervention_names, ensure_ascii=False),
            "intervention_types": json.dumps(intervention_types, ensure_ascii=False),

            # 时间与规模
            "enrollment_count": dsm.get("enrollmentInfo", {}).get("count"),
            "enrollment_type": dsm.get("enrollmentInfo", {}).get("type", ""),
            "start_date": _format_date(stm.get("startDateStruct", {}).get("date")),
            "completion_date": _format_date(stm.get("completionDateStruct", {}).get("date")),
            "primary_completion_date": _format_date(stm.get("primaryCompletionDateStruct", {}).get("date")),
            "last_update_date": _format_date(stm.get("lastUpdatePostDateStruct", {}).get("date")),

            # 链接
            "source_url": f"https://clinicaltrials.gov/study/{nct_id}",

            # 关联数据(用于 trial_locations 表)
            "locations": locations,
        }
    except Exception as e:
        print(f"[ERROR] 转换失败: {e}")
        return None


def _format_date(date_str: Optional[str]) -> Optional[str]:
    """
    统一日期格式为 ISO 8601 (YYYY-MM-DD)
    API 返回可能是 "2025-11-12" 或 "2025-11" 或 "2025"
    """
    if not date_str:
        return None
    # 已经是 YYYY-MM-DD 直接返回
    if len(date_str) == 10 and date_str[4] == "-" and date_str[7] == "-":
        return date_str
    # YYYY-MM 补 -01
    if len(date_str) == 7 and date_str[4] == "-":
        return f"{date_str}-01"
    # YYYY 补 -01-01
    if len(date_str) == 4:
        return f"{date_str}-01-01"
    return date_str


def extract_search_text(trial: dict) -> str:
    """
    提取试验的纯文本,用于全文搜索索引
    """
    parts = [
        trial.get("brief_title", ""),
        trial.get("official_title", ""),
        trial.get("brief_summary", ""),
        trial.get("lead_sponsor", ""),
        trial.get("conditions", ""),
    ]
    return " ".join(p for p in parts if p)


# ============================================================
# 命令行测试
# ============================================================

if __name__ == "__main__":
    # 用 fetch_trials 拉一条真实数据测试
    from fetch_trials import fetch_oncology_trials

    print("[TEST] 拉一条试验,测试 transform...")
    for raw in fetch_oncology_trials(page_size=1, only_recruiting=False):
        result = transform_trial(raw)
        if result:
            print(f"[OK] 转换成功: {result['nct_id']}")
            print(f"     标题: {result['brief_title'][:60]}")
            print(f"     状态: {result['overall_status']}")
            print(f"     阶段: {result['phases']}")
            print(f"     地点数: {len(result['locations'])}")
            print(f"     干预数: {len(result['intervention_names'])}")
            break
        else:
            print("[FAIL] 转换失败")