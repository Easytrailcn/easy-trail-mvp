"""
EasyTrail ETL: 数据写入 Cloudflare D1 数据库
=============================================

通过 Cloudflare HTTP API 写入 D1 数据库。
也支持本地 SQLite 测试模式。
"""

import json
import sqlite3
from typing import Optional
import requests


# ============================================================
# Cloudflare D1 HTTP API 写入
# ============================================================

class D1Writer:
    """Cloudflare D1 数据库写入器"""

    def __init__(self, account_id: str, database_id: str, api_token: str):
        self.account_id = account_id
        self.database_id = database_id
        self.api_token = api_token
        self.base_url = (
            f"https://api.cloudflare.com/client/v4/accounts/{account_id}"
            f"/d1/database/{database_id}"
        )
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        }

    def execute(self, sql: str, params: list = None) -> dict:
        """执行单条 SQL"""
        body = {"sql": sql, "params": params or []}
        response = requests.post(
            f"{self.base_url}/query",
            headers=self.headers,
            json=body,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def execute_batch(self, sql_statements: list) -> dict:
        """批量执行多条 SQL"""
        # D1 支持一次最多 10000 条语句
        chunks = [sql_statements[i:i+100] for i in range(0, len(sql_statements), 100)]
        results = []
        for chunk in chunks:
            response = requests.post(
                f"{self.base_url}/query",
                headers=self.headers,
                json={"file": "batch", "sql": "\n".join(chunk)},
                timeout=60,
            )
            response.raise_for_status()
            results.append(response.json())
        return {"chunks": len(chunks), "results": results}


# ============================================================
# 单条试验的写入逻辑
# ============================================================

def upsert_trial(writer, trial: dict) -> str:
    """
    插入或更新一条试验(及其地点)

    返回:
        "inserted" / "updated" / "failed"
    """
    nct_id = trial["nct_id"]

    # 1. 检查是否存在
    check_sql = "SELECT nct_id, last_update_date FROM trials WHERE nct_id = ?"
    try:
        result = writer.execute(check_sql, [nct_id])
        rows = result.get("result", [{}])[0].get("results", [])
        exists = len(rows) > 0
    except Exception as e:
        print(f"[ERROR] 检查试验存在性失败 {nct_id}: {e}")
        return "failed"

    # 2. 插入或更新 trials 表
    trial_sql = """
        INSERT INTO trials (
            nct_id, brief_title, official_title, brief_summary, detailed_description,
            overall_status, conditions, phases, study_type, lead_sponsor,
            eligibility_criteria, min_age, max_age, gender,
            intervention_names, intervention_types,
            enrollment_count, enrollment_type,
            start_date, completion_date, primary_completion_date, last_update_date,
            source_url, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(nct_id) DO UPDATE SET
            brief_title=excluded.brief_title,
            official_title=excluded.official_title,
            brief_summary=excluded.brief_summary,
            detailed_description=excluded.detailed_description,
            overall_status=excluded.overall_status,
            conditions=excluded.conditions,
            phases=excluded.phases,
            study_type=excluded.study_type,
            lead_sponsor=excluded.lead_sponsor,
            eligibility_criteria=excluded.eligibility_criteria,
            min_age=excluded.min_age,
            max_age=excluded.max_age,
            gender=excluded.gender,
            intervention_names=excluded.intervention_names,
            intervention_types=excluded.intervention_types,
            enrollment_count=excluded.enrollment_count,
            enrollment_type=excluded.enrollment_type,
            start_date=excluded.start_date,
            completion_date=excluded.completion_date,
            primary_completion_date=excluded.primary_completion_date,
            last_update_date=excluded.last_update_date,
            source_url=excluded.source_url,
            updated_at=datetime('now')
    """
    trial_params = [
        trial["nct_id"],
        trial["brief_title"],
        trial["official_title"],
        trial["brief_summary"],
        trial["detailed_description"],
        trial["overall_status"],
        trial["conditions"],
        trial["phases"],
        trial["study_type"],
        trial["lead_sponsor"],
        trial["eligibility_criteria"],
        trial["min_age"],
        trial["max_age"],
        trial["gender"],
        trial["intervention_names"],
        trial["intervention_types"],
        trial["enrollment_count"],
        trial["enrollment_type"],
        trial["start_date"],
        trial["completion_date"],
        trial["primary_completion_date"],
        trial["last_update_date"],
        trial["source_url"],
    ]

    try:
        writer.execute(trial_sql, trial_params)
    except Exception as e:
        print(f"[ERROR] 写入 trial 失败 {nct_id}: {e}")
        return "failed"

    # 3. 删除旧 locations,插入新 locations
    try:
        writer.execute("DELETE FROM trial_locations WHERE nct_id = ?", [nct_id])
        for loc in trial.get("locations", []):
            loc_sql = """
                INSERT INTO trial_locations
                    (nct_id, facility, city, state, country, status)
                VALUES (?, ?, ?, ?, ?, ?)
            """
            writer.execute(loc_sql, [
                nct_id,
                loc.get("facility"),
                loc.get("city"),
                loc.get("state"),
                loc.get("country"),
                loc.get("status"),
            ])
    except Exception as e:
        print(f"[WARN] 写入 locations 失败 {nct_id}: {e}")
        # 失败不算致命,继续

    return "updated" if exists else "inserted"


def write_sync_log(writer, log_data: dict) -> None:
    """写入同步日志"""
    sql = """
        INSERT INTO sync_log (
            sync_mode, trials_fetched, trials_filtered,
            trials_inserted, trials_updated, trials_failed,
            duration_seconds, status, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    params = [
        log_data.get("sync_mode", "full"),
        log_data.get("trials_fetched", 0),
        log_data.get("trials_filtered", 0),
        log_data.get("trials_inserted", 0),
        log_data.get("trials_updated", 0),
        log_data.get("trials_failed", 0),
        log_data.get("duration_seconds", 0),
        log_data.get("status", "success"),
        log_data.get("error_message", ""),
    ]
    try:
        writer.execute(sql, params)
    except Exception as e:
        print(f"[ERROR] 写同步日志失败: {e}")


# ============================================================
# 本地 SQLite 测试模式(开发用)
# ============================================================

def get_local_sqlite(db_path: str = "easytrail.db") -> D1Writer:
    """包装一个本地 SQLite 连接,模拟 D1 接口(开发测试用)"""
    return LocalSQLiteAdapter(db_path)


class LocalSQLiteAdapter:
    """本地 SQLite 适配器,接口与 D1Writer 一致"""

    def __init__(self, db_path: str):
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row

    def execute(self, sql: str, params: list = None):
        cur = self.conn.execute(sql, params or [])
        self.conn.commit()
        return {"result": [{"results": [dict(row) for row in cur.fetchall()]}]}

    def execute_batch(self, sql_statements: list):
        results = []
        for sql in sql_statements:
            try:
                results.append(self.execute(sql))
            except Exception as e:
                results.append({"error": str(e)})
        return {"chunks": 1, "results": results}

    def close(self):
        self.conn.close()


# ============================================================
# 命令行测试
# ============================================================

if __name__ == "__main__":
    # 本地 SQLite 模式测试
    print("[TEST] 本地 SQLite 模式...")
    writer = get_local_sqlite("test_easytrail.db")

    # 初始化 schema
    with open("../db/schema.sql", "r", encoding="utf-8") as f:
        schema_sql = f.read()
    for stmt in schema_sql.split(";"):
        stmt = stmt.strip()
        if stmt:
            writer.execute(stmt)

    print("[OK] schema 创建成功")
    writer.close()