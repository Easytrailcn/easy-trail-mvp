/**
 * EasyTrail 搜索页脚本
 */

const STATE = {
  q: '',
  condition: '',
  phase: '',
  status: 'RECRUITING',
  country: '',
  studyType: '',
  chinaOnly: true,   // A3: 默认国内
  limit: PAGE_SIZE,
  offset: 0,
  total: 0,
  loading: false,
};

document.addEventListener('DOMContentLoaded', () => {
  STATE.q = urlParam('q');
  STATE.condition = urlParam('condition');
  STATE.phase = urlParam('phase');
  STATE.status = urlParam('status', 'RECRUITING');
  STATE.country = urlParam('country');
  STATE.studyType = urlParam('study_type');
  // A3: 从 URL 读 ?global=1
  STATE.chinaOnly = urlParam('global') !== '1';

  document.getElementById('search-input').value = STATE.q;
  document.getElementById('filter-status').value = STATE.status;
  document.getElementById('filter-phase').value = STATE.phase;
  document.getElementById('filter-country').value = STATE.country;
  syncScopeButtons();

  bindEvents();
  search();
});

function bindEvents() {
  document.querySelector('.search-bar').addEventListener('submit', (e) => {
    e.preventDefault();
    STATE.q = document.getElementById('search-input').value.trim();
    STATE.offset = 0;
    search();
  });

  document.getElementById('filter-status').addEventListener('change', (e) => {
    STATE.status = e.target.value;
    STATE.offset = 0;
    search();
  });

  document.getElementById('filter-phase').addEventListener('change', (e) => {
    STATE.phase = e.target.value;
    STATE.offset = 0;
    search();
  });

  document.getElementById('filter-country').addEventListener('change', (e) => {
    STATE.country = e.target.value;
    STATE.offset = 0;
    search();
  });

  document.getElementById('filter-reset').addEventListener('click', () => {
    STATE.q = '';
    STATE.condition = '';
    STATE.phase = '';
    STATE.status = 'RECRUITING';
    STATE.country = '';
    STATE.studyType = '';
    STATE.chinaOnly = true;  // A3: 重置回国内
    STATE.offset = 0;

    document.getElementById('search-input').value = '';
    document.getElementById('filter-status').value = 'RECRUITING';
    document.getElementById('filter-phase').value = '';
    document.getElementById('filter-country').value = '';
    syncScopeButtons();

    search();
  });

  // A3: 国内/全球切换
  document.getElementById('scope-china').addEventListener('click', () => {
    if (!STATE.chinaOnly) {
      STATE.chinaOnly = true;
      STATE.offset = 0;
      syncScopeButtons();
      search();
    }
  });
  document.getElementById('scope-global').addEventListener('click', () => {
    if (STATE.chinaOnly) {
      STATE.chinaOnly = false;
      STATE.offset = 0;
      syncScopeButtons();
      search();
    }
  });

  document.getElementById('prev-page').addEventListener('click', () => {
    if (STATE.offset > 0) {
      STATE.offset = Math.max(0, STATE.offset - STATE.limit);
      search();
    }
  });

  document.getElementById('next-page').addEventListener('click', () => {
    if (STATE.offset + STATE.limit < STATE.total) {
      STATE.offset += STATE.limit;
      search();
    }
  });
}

async function search() {
  if (STATE.loading) return;
  STATE.loading = true;

  const listEl = document.getElementById('results-list');
  listEl.innerHTML = '<div class="loading">加载中...</div>';

  try {
    const params = {
      q: STATE.q,
      condition: STATE.condition,
      phase: STATE.phase,
      status: STATE.status,
      country: STATE.country,
      limit: STATE.limit,
      offset: STATE.offset,
    };
    // A3: china_only 参数
    if (!STATE.chinaOnly) params.global = '1';

    Object.keys(params).forEach(k => {
      if (params[k] === '' || params[k] === null || params[k] === undefined) delete params[k];
    });

    const result = await API.searchTrials(params);
    // API 返回 { success, data: { total, results } }
    const data = result.data || result;
    STATE.total = data.total || 0;

    renderResults(data.results);
    renderPagination();
    renderSummary();

    updateUrl();
  } catch (err) {
    listEl.innerHTML = '<div class="empty-state"><h3>加载失败</h3><p>' + escapeHtml(err.message) + '</p><p style="font-size:0.85rem;margin-top:1rem;">可能是网络问题或后端服务暂未启动,请稍后重试</p></div>';
  } finally {
    STATE.loading = false;
  }
}

function renderResults(trials) {
  const listEl = document.getElementById('results-list');

  if (!trials || trials.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><h3>未找到符合条件的试验</h3><p>试试调整关键词或筛选条件</p></div>';
    return;
  }

  listEl.innerHTML = trials.map(t => renderTrialCard(t)).join('');

  listEl.querySelectorAll('.trial-card').forEach(card => {
    card.addEventListener('click', () => {
      const nctId = card.dataset.nct;
      window.location.href = 'trial.html?nct=' + nctId;
    });
  });
}

function renderTrialCard(trial) {
  // 字段适配: API 列表接口字段名 (title/status/phase/condition/sponsor) -> 前端期望 (brief_title/overall_status/phases/conditions/lead_sponsor)
  const title = trial.title || trial.brief_title || '无标题';
  const status = trial.status || trial.overall_status;
  const phase = trial.phase || trial.phases;
  const sponsor = trial.sponsor || trial.sponsor_name || trial.lead_sponsor;
  const phaseLabel = formatPhase(phase);
  // condition 可能是 string 或 array
  let conditionList = [];
  if (Array.isArray(trial.conditions)) conditionList = trial.conditions.slice(0, 3);
  else if (typeof trial.condition === 'string' && trial.condition) conditionList = trial.condition.split(/[;,、]/).map(s => s.trim()).filter(Boolean).slice(0, 3);

  let html = '<div class="trial-card" data-nct="' + escapeHtml(trial.nct_id) + '">';
  html += '<div class="trial-card-header">';
  html += '<div class="trial-card-title">' + escapeHtml(title) + '</div>';
  html += '<div class="trial-card-id">' + escapeHtml(trial.nct_id) + '</div>';
  html += '</div>';

  html += '<div class="trial-card-meta">';
  html += '<span class="status-badge status-' + escapeHtml(status || '') + '">' + escapeHtml(formatStatus(status)) + '</span>';
  if (phaseLabel) html += '<span class="phase-badge">' + escapeHtml(phaseLabel) + '</span>';
  if (sponsor) html += '<span class="meta-item">🏢 ' + escapeHtml(sponsor) + '</span>';
  // 列表接口无 location_count, 跳过
  html += '</div>';

  if (conditionList.length > 0) {
    html += '<div class="trial-card-meta"><span class="meta-item">🩺 ';
    html += conditionList.map(c => escapeHtml(c)).join('、');
    html += '</span></div>';
  }

  if (trial.primary_completion_date) {
    html += '<div class="trial-card-meta"><span class="meta-item">📅 主要完成: ' + formatDate(trial.primary_completion_date) + '</span></div>';
  }

  // 列表接口无 official_title, 跳过

  html += '</div>';
  return html;
}

function renderPagination() {
  const paginationEl = document.getElementById('pagination');
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  const pageInfo = document.getElementById('page-info');

  if (STATE.total <= STATE.limit) {
    paginationEl.style.display = 'none';
    return;
  }

  paginationEl.style.display = 'flex';
  const currentPage = Math.floor(STATE.offset / STATE.limit) + 1;
  const totalPages = Math.ceil(STATE.total / STATE.limit);
  pageInfo.textContent = '第 ' + currentPage + ' / ' + totalPages + ' 页';

  prevBtn.disabled = STATE.offset === 0;
  nextBtn.disabled = STATE.offset + STATE.limit >= STATE.total;
}

function renderSummary() {
  document.getElementById('total-count').textContent = STATE.total;
  const parts = [];
  if (STATE.q) parts.push('关键词: "' + STATE.q + '"');
  if (STATE.condition) parts.push('疾病: ' + STATE.condition);
  if (STATE.phase) parts.push('阶段: ' + formatPhase(STATE.phase));
  if (STATE.country) parts.push('地区: ' + STATE.country);
  document.getElementById('search-summary').textContent = parts.length ? '(' + parts.join(' · ') + ')' : '';
}

function updateUrl() {
  const params = new URLSearchParams();
  if (STATE.q) params.set('q', STATE.q);
  if (STATE.condition) params.set('condition', STATE.condition);
  if (STATE.phase) params.set('phase', STATE.phase);
  if (STATE.status) params.set('status', STATE.status);
  if (STATE.country) params.set('country', STATE.country);
  if (!STATE.chinaOnly) params.set('global', '1');  // A3

  const newUrl = window.location.pathname + '?' + params.toString();
  window.history.replaceState({}, '', newUrl);
}

function syncScopeButtons() {
  const chinaBtn = document.getElementById('scope-china');
  const globalBtn = document.getElementById('scope-global');
  if (!chinaBtn || !globalBtn) return;
  chinaBtn.classList.toggle('active', STATE.chinaOnly);
  globalBtn.classList.toggle('active', !STATE.chinaOnly);
}