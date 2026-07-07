"""
EasyTrail ETL: 从 ClinicalTrials.gov v2 API 抓取临床试验数据
"""

import requests
import time
from typing import Optional, Iterator
from datetime import datetime, timedelta

API_BASE = "https://clinicaltrials.gov/api/v2/studies"
PAGE_SIZE = 200
MAX_PAGES = 100  # 防止无限循环
REQUEST_TIMEOUT = 30  # 秒
RETRY_TIMES = 3
RETRY_BACKOFF = 2  # 指数退避基数


def fetch_oncology_trials(
    last_update: Optional[str] = None,
    page_size: int = PAGE_SIZE,
    only_recruiting: bool = True,
) -> Iterator[dict]:
    """
    增量拉取肿瘤相关试验数据

    参数:
        last_update: 上次同步时间(ISO 格式),None 表示全量
        page_size: 每页条数(最大 1000)
        only_recruiting: 是否只拉招募中的试验

    返回:
        试验字典的迭代器
    """
    # 关键词:肿瘤相关的多个术语(覆盖各种叫法)
    oncology_query = "neoplasm OR cancer OR tumor OR carcinoma OR malignancy OR oncology"

    params = {
        "query.cond": oncology_query,
        "pageSize": page_size,
        "format": "json",
    }

    # 状态过滤
    if only_recruiting:
        params["filter.overallStatus"] = (
            "RECRUITING|ACTIVE_NOT_RECRUITING|NOT_YET_RECRUITING"
        )
    else:
        params["filter.overallStatus"] = (
            "RECRUITING|ACTIVE_NOT_RECRUITING|NOT_YET_RECRUITING|"
            "COMPLETED|SUSPENDED|TERMINATED"
        )

    # 增量同步:加时间范围过滤
    if last_update:
        params["filter.advanced"] = f"AREA[LastUpdatePostDate]RANGE[{last_update},MAX]"

    page_count = 0
    next_page_token = None

    while page_count < MAX_PAGES:
        page_count += 1

        # 加分页 token
        if next_page_token:
            params["pageToken"] = next_page_token

        # 发起请求(带重试)
        response = _request_with_retry(API_BASE, params)
        if not response:
            print(f"[ERROR] 请求失败,page={page_count}")
            break

        data = response.json()
        studies = data.get("studies", [])

        if not studies:
            print(f"[INFO] 第 {page_count} 页无数据,同步结束")
            break

        for study in studies:
            yield study

        # 翻页
        next_page_token = data.get("nextPageToken")
        if not next_page_token:
            print(f"[INFO] 已到末页,共 {page_count} 页")
            break

        # 友好限速(API 无明确限速,保守一点)
        time.sleep(0.5)


def _request_with_retry(url: str, params: dict) -> Optional[requests.Response]:
    """带重试的 HTTP GET 请求"""
    for attempt in range(RETRY_TIMES):
        try:
            response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException as e:
            print(f"[WARN] 请求失败(第 {attempt+1}/{RETRY_TIMES} 次): {e}")
            if attempt < RETRY_TIMES - 1:
                time.sleep(RETRY_BACKOFF ** attempt)
            else:
                return None
    return None


def get_last_sync_time(db_conn) -> Optional[str]:
    """
    从数据库读取上次成功同步的时间
    用于增量同步
    """
    cursor = db_conn.execute(
        "SELECT sync_time FROM sync_log "
        "WHERE status='success' "
        "ORDER BY sync_time DESC LIMIT 1"
    )
    row = cursor.fetchone()
    if row:
        # 转 ISO 格式给 API 用
        return row[0].replace(" ", "T") + "Z"
    return None


def count_trials(last_update: Optional[str] = None) -> int:
    """
    估算待同步的试验数量(用于日志)
    """
    params = {
        "query.cond": "neoplasm OR cancer OR tumor OR carcinoma OR malignancy",
        "filter.overallStatus": (
            "RECRUITING|ACTIVE_NOT_RECRUITING|NOT_YET_RECRUITING"
        ),
        "pageSize": 1,
        "format": "json",
        "fields": ["NCTId"],
    }
    if last_update:
        params["filter.advanced"] = f"AREA[LastUpdatePostDate]RANGE[{last_update},MAX]"

    response = _request_with_retry(API_BASE, params)
    if response:
        return response.json().get("totalCount", 0)
    return 0


# ============================================================
# 命令行测试
# ============================================================

if __name__ == "__main__":
    print("[TEST] 拉取前 5 条肿瘤试验,验证 API 连接...")
    count = 0
    for trial in fetch_oncology_trials(page_size=5):
        nct = trial.get("protocolSection", {}).get("identificationModule", {}).get("nctId")
        title = trial.get("protocolSection", {}).get("identificationModule", {}).get("briefTitle")
        print(f"  - {nct}: {title[:60]}...")
        count += 1
        if count >= 5:
            break
    print(f"[TEST] 完成,共获取 {count} 条")