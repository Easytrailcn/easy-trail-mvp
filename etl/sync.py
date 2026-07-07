"""
EasyTrail ETL 主入口
====================

由 GitHub Actions 定时调用。
负责:拉数据 → 过滤 → 转换 → 入库 → 写日志。
"""

import argparse
import os
import sys
import time
from datetime import datetime

# 添加当前目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fetch_trials import fetch_oncology_trials, count_trials
from transform import transform_trial
from load import upsert_trial, write_sync_log, D1Writer, get_local_sqlite
from config.filters import should_exclude_trial, EMPLOYMENT_FILTER


def run_sync(mode: str = "incremental", dry_run: bool = False) -> dict:
    """
    执行一次完整的数据同步

    参数:
        mode: "full" / "incremental" / "test"
        dry_run: True = 只跑流程不入库(用于调试)

    返回:
        同步结果统计
    """
    started_at = time.time()
    start_time_str = datetime.utcnow().isoformat() + "Z"

    stats = {
        "sync_mode": mode,
        "trials_fetched": 0,
        "trials_filtered": 0,
        "trials_inserted": 0,
        "trials_updated": 0,
        "trials_failed": 0,
        "started_at": start_time_str,
    }

    print(f"[SYNC] 开始同步 (mode={mode}, dry_run={dry_run})")
    print(f"[SYNC] 在职过滤启用: {EMPLOYMENT_FILTER['enabled']}")
    if EMPLOYMENT_FILTER["enabled"]:
        print(f"[SYNC] 黑名单关键词数: {len(EMPLOYMENT_FILTER['exclude_keywords'])}")

    # 1. 初始化写入器
    writer = None
    if not dry_run:
        if mode == "test":
            writer = get_local_sqlite("easytrail_test.db")
        else:
            # 生产模式:用环境变量里的 Cloudflare 凭据
            account_id = os.environ.get("CF_ACCOUNT_ID")
            database_id = os.environ.get("CF_D1_DATABASE_ID")
            api_token = os.environ.get("CF_API_TOKEN")
            if not all([account_id, database_id, api_token]):
                print("[ERROR] 缺少 Cloudflare 凭据环境变量")
                return {**stats, "status": "failed", "error_message": "missing credentials"}
            writer = D1Writer(account_id, database_id, api_token)

    # 2. 拉数据
    only_recruiting = (mode != "full")
    try:
        for raw_trial in fetch_oncology_trials(only_recruiting=only_recruiting):
            stats["trials_fetched"] += 1

            # 进度日志(每 100 条打一次)
            if stats["trials_fetched"] % 100 == 0:
                print(f"[SYNC] 已处理 {stats['trials_fetched']} 条...")

            # 3. 应用过滤(EMPLOYMENT_FILTER 等)
            if should_exclude_trial(raw_trial):
                stats["trials_filtered"] += 1
                continue

            # 4. 数据转换
            trial = transform_trial(raw_trial)
            if not trial:
                stats["trials_failed"] += 1
                continue

            # 5. 写入数据库
            if dry_run:
                # 只打印前几条,不入库
                if stats["trials_fetched"] <= 3:
                    print(f"[DRY-RUN] {trial['nct_id']}: {trial['brief_title'][:50]}")
                stats["trials_inserted"] += 1  # 模拟统计
            else:
                result = upsert_trial(writer, trial)
                if result == "inserted":
                    stats["trials_inserted"] += 1
                elif result == "updated":
                    stats["trials_updated"] += 1
                else:
                    stats["trials_failed"] += 1

    except Exception as e:
        print(f"[ERROR] 同步过程中异常: {e}")
        stats["status"] = "failed"
        stats["error_message"] = str(e)
        return stats

    # 6. 计算耗时,写日志
    duration = time.time() - started_at
    stats["duration_seconds"] = round(duration, 2)
    stats["status"] = "success" if stats["trials_failed"] == 0 else "partial"

    print(f"\n[SYNC] 完成!")
    print(f"  - 抓取: {stats['trials_fetched']}")
    print(f"  - 过滤: {stats['trials_filtered']}")
    print(f"  - 新增: {stats['trials_inserted']}")
    print(f"  - 更新: {stats['trials_updated']}")
    print(f"  - 失败: {stats['trials_failed']}")
    print(f"  - 耗时: {stats['duration_seconds']}s")
    print(f"  - 状态: {stats['status']}")

    if not dry_run and writer:
        write_sync_log(writer, stats)
        if hasattr(writer, "close"):
            writer.close()

    return stats


def main():
    parser = argparse.ArgumentParser(description="EasyTrail 数据同步 ETL")
    parser.add_argument(
        "--mode",
        choices=["full", "incremental", "test"],
        default="incremental",
        help="同步模式: full=全量 / incremental=增量 / test=本地测试",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="只跑流程不写数据库",
    )

    args = parser.parse_args()
    run_sync(mode=args.mode, dry_run=args.dry_run)


if __name__ == "__main__":
    main()