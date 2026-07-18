/**
 * EasyTrail 首页脚本
 */

document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  initSearchButtons();
});

function initSearchButtons() {
  const form = document.querySelector('.search-form');
  const hiddenGlobal = document.getElementById('global-input');
  if (!form || !hiddenGlobal) return;

  const tabChina = document.getElementById('tab-china');
  const tabGlobal = document.getElementById('tab-global');

  function setScope(scope) {
    if (scope === 'china') {
      tabChina.classList.add('active');
      tabChina.setAttribute('aria-selected', 'true');
      tabGlobal.classList.remove('active');
      tabGlobal.setAttribute('aria-selected', 'false');
      hiddenGlobal.value = '0';
    } else {
      tabGlobal.classList.add('active');
      tabGlobal.setAttribute('aria-selected', 'true');
      tabChina.classList.remove('active');
      tabChina.setAttribute('aria-selected', 'false');
      hiddenGlobal.value = '1';
    }
  }

  if (tabChina) tabChina.addEventListener('click', () => setScope('china'));
  if (tabGlobal) tabGlobal.addEventListener('click', () => setScope('global'));

  // 默认国内
  setScope('china');
}

async function loadStats() {
  try {
    const resp = await API.getStats();
    // API 返回 { success, data: {...} }
    const stats = resp.data || resp;
    document.getElementById('stat-total').textContent = (stats.total_trials || 0).toLocaleString();
    document.getElementById('stat-recruiting').textContent = (stats.recruiting_trials || 0).toLocaleString();
    document.getElementById('stat-locations').textContent = (stats.locations_total || stats.countries || 0).toLocaleString();

    const syncTime = stats.last_etl_time || stats.last_sync || stats.last_full_completed;
    if (syncTime) {
      document.getElementById('stat-last-sync').textContent = formatDateTime(syncTime);
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