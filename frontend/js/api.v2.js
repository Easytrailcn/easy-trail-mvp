/**
 * EasyTrail API 调用封装
 * =======================
 */

const API = {
  async getStats() {
    return this._fetch('/api/stats');
  },

  async searchTrials(params) {
    const query = new URLSearchParams(params).toString();
    return this._fetch(`/api/trials?${query}`);
  },

  async getTrial(nctId) {
    return this._fetch(`/api/trials/${nctId}`);
  },

  async getFacets() {
    return this._fetch('/api/facets');
  },

  async health() {
    return this._fetch('/api/health');
  },

  async _fetch(path) {
    try {
      const response = await fetch(API_BASE + path, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('[API Error]', err);
      throw err;
    }
  },
};

/**
 * 工具函数
 */

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatStatus(status) {
  const labels = {
    'RECRUITING': '招募中',
    'ACTIVE_NOT_RECRUITING': '进行中',
    'NOT_YET_RECRUITING': '尚未招募',
    'COMPLETED': '已完成',
    'TERMINATED': '已终止',
    'SUSPENDED': '已暂停',
    'WITHDRAWN': '已撤回',
  };
  return labels[status] || status;
}

function formatPhase(phase) {
  if (!phase) return '';
  if (Array.isArray(phase)) {
    return phase.map(p => formatPhase(p)).filter(Boolean).join(', ');
  }
  // 先把老格式的逗号分隔转成斜杠
  const normalized = phase.replace(/,/g, '/');
  const labels = {
    'PHASE1': 'I 期',
    'PHASE2': 'II 期',
    'PHASE3': 'III 期',
    'PHASE4': 'IV 期',
    'PHASE1/PHASE2': 'I/II 期',
    'PHASE2/PHASE3': 'II/III 期',
    'NA': '不适用',
    'EARLY_PHASE1': '早期 I 期',
  };
  return labels[normalized] || normalized;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) return '--';
  try {
    const d = new Date(dateStr.replace(' ', 'T') + (dateStr.includes('Z') ? '' : 'Z'));
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 60) return `${diffMin} 分钟前`;
    if (diffHour < 24) return `${diffHour} 小时前`;
    if (diffDay < 7) return `${diffDay} 天前`;
    return formatDate(dateStr);
  } catch {
    return dateStr;
  }
}

function urlParam(key, defaultValue = '') {
  const params = new URLSearchParams(window.location.search);
  return params.get(key) || defaultValue;
}