/**
 * EasyTrail 首页脚本
 */

document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
});

async function loadStats() {
  try {
    const stats = await API.getStats();
    document.getElementById('stat-total').textContent = (stats.trials_total || 0).toLocaleString();
    document.getElementById('stat-recruiting').textContent = (stats.trials_recruiting || 0).toLocaleString();
    document.getElementById('stat-locations').textContent = (stats.locations_total || 0).toLocaleString();

    if (stats.last_sync) {
      document.getElementById('stat-last-sync').textContent = formatDateTime(stats.last_sync.sync_time);
    } else {
      document.getElementById('stat-last-sync').textContent = '尚未同步';
    }
  } catch (err) {
    console.error('加载统计失败:', err);
    document.getElementById('stat-total').textContent = '--';
    document.getElementById('stat-recruiting').textContent = '--';
    document.getElementById('stat-locations').textContent = '--';
    document.getElementById('stat-last-sync').textContent = '尚未同步';
  }
}