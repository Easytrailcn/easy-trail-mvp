/**
 * EasyTrail 试验详情页脚本
 */

document.addEventListener('DOMContentLoaded', async () => {
  const nctId = urlParam('nct');
  if (!nctId) {
    showError('未指定试验编号', '请从搜索页进入查看试验详情');
    return;
  }

  if (!/^NCT\d{8}$/.test(nctId)) {
    showError('试验编号格式不正确', 'NCT 编号应为 NCT 开头加 8 位数字,例:NCT07444203');
    return;
  }

  await loadTrial(nctId);
});

async function loadTrial(nctId) {
  const detailEl = document.getElementById('trial-detail');
  detailEl.innerHTML = '<div class="detail-loading">加载中...</div>';

  try {
    const trial = await API.getTrial(nctId);
    renderTrial(trial);
    document.title = (trial.brief_title || '试验详情') + ' - EasyTrail';
  } catch (err) {
    showError('加载失败', err.message);
  }
}

function renderTrial(trial) {
  const detailEl = document.getElementById('trial-detail');

  const phaseLabel = formatPhase(trial.phases);
  const conditionList = Array.isArray(trial.conditions) ? trial.conditions : [];
  const interventionNames = Array.isArray(trial.intervention_names) ? trial.intervention_names : [];
  const interventionTypes = Array.isArray(trial.intervention_types) ? trial.intervention_types : [];

  let html = '';

  // 顶部 header
  html += '<div class="detail-header">';
  html += '<div class="detail-nct">' + escapeHtml(trial.nct_id) + '</div>';
  html += '<h1 class="detail-title">' + escapeHtml(trial.brief_title || '无标题') + '</h1>';
  if (trial.official_title && trial.official_title !== trial.brief_title) {
    html += '<div class="detail-official">' + escapeHtml(trial.official_title) + '</div>';
  }
  html += '<div class="detail-badges">';
  html += '<span class="status-badge status-' + escapeHtml(trial.overall_status) + '">' + formatStatus(trial.overall_status) + '</span>';
  if (phaseLabel) html += '<span class="phase-badge">' + escapeHtml(phaseLabel) + '</span>';
  if (trial.study_type) html += '<span class="phase-badge">' + escapeHtml(trial.study_type) + '</span>';
  html += '</div>';
  html += '<div class="detail-actions">';
  html += '<a href="' + escapeHtml(trial.source_url) + '" target="_blank" rel="noopener" class="detail-button primary">🔗 查看 ClinicalTrials.gov 原文</a>';
  html += '<button class="detail-button" onclick="copyShareLink(\'' + escapeHtml(trial.nct_id) + '\')">📋 复制分享链接</button>';
  html += '</div>';
  html += '</div>';

  // 基本信息
  html += '<div class="detail-section">';
  html += '<h2>基本信息</h2>';
  html += '<table class="field-table">';
  html += fieldRow('NCT 编号', trial.nct_id);
  html += fieldRow('招募状态', formatStatus(trial.overall_status));
  if (trial.study_type) html += fieldRow('研究类型', trial.study_type);
  if (phaseLabel) html += fieldRow('试验阶段', phaseLabel);
  if (trial.lead_sponsor) html += fieldRow('主办方', trial.lead_sponsor);
  if (trial.enrollment_count) html += fieldRow('计划招募人数', trial.enrollment_count + ' 人');
  if (trial.start_date) html += fieldRow('开始日期', formatDate(trial.start_date));
  if (trial.primary_completion_date) html += fieldRow('主要完成日期', formatDate(trial.primary_completion_date));
  if (trial.completion_date) html += fieldRow('预计完成日期', formatDate(trial.completion_date));
  if (trial.last_update_date) html += fieldRow('数据更新', formatDate(trial.last_update_date));
  html += '</table>';
  html += '</div>';

  // 疾病/适应症
  if (conditionList.length > 0) {
    html += '<div class="detail-section">';
    html += '<h2>疾病 / 适应症</h2>';
    html += '<div>' + conditionList.map(c => escapeHtml(c)).join('、') + '</div>';
    html += '</div>';
  }

  // 简介
  if (trial.brief_summary) {
    html += '<div class="detail-section">';
    html += '<h2>简介</h2>';
    html += '<div>' + escapeHtml(trial.brief_summary) + '</div>';
    html += '</div>';
  }

  // 详细描述
  if (trial.detailed_description && trial.detailed_description !== trial.brief_summary) {
    html += '<div class="detail-section">';
    html += '<h2>详细描述</h2>';
    html += '<div>' + escapeHtml(trial.detailed_description) + '</div>';
    html += '</div>';
  }

  // 干预措施
  if (interventionNames.length > 0) {
    html += '<div class="detail-section">';
    html += '<h2>干预措施</h2>';
    html += '<table class="field-table">';
    for (let i = 0; i < interventionNames.length; i++) {
      html += '<tr>';
      html += '<th>' + escapeHtml(interventionTypes[i] || '类型') + '</th>';
      html += '<td>' + escapeHtml(interventionNames[i]) + '</td>';
      html += '</tr>';
    }
    html += '</table>';
    html += '</div>';
  }

  // 入组标准
  if (trial.eligibility_criteria) {
    html += '<div class="detail-section">';
    html += '<h2>入组标准</h2>';
    html += '<table class="field-table">';
    if (trial.min_age) html += fieldRow('最低年龄', trial.min_age);
    if (trial.max_age) html += fieldRow('最高年龄', trial.max_age);
    if (trial.gender) html += fieldRow('性别', trial.gender === 'ALL' ? '不限' : trial.gender);
    html += '</table>';
    html += '<div style="margin-top:1rem;white-space:pre-wrap;">' + escapeHtml(trial.eligibility_criteria) + '</div>';
    html += '</div>';
  }

  // 试验地点
  if (trial.locations && trial.locations.length > 0) {
    html += '<div class="detail-section">';
    html += '<h2>试验地点 (' + trial.locations.length + ' 个)</h2>';
    for (const loc of trial.locations) {
      html += '<div class="location-item">';
      html += '<div class="location-facility">';
      html += escapeHtml(loc.facility || '机构名未公开');
      if (loc.status) html += '<span class="location-status">' + formatStatus(loc.status) + '</span>';
      html += '</div>';
      const addr = [loc.city, loc.state, loc.country].filter(Boolean).join(', ');
      if (addr) html += '<div class="location-address">📍 ' + escapeHtml(addr) + '</div>';
      html += '</div>';
    }
    html += '</div>';
  }

  // 底部合规声明
  html += '<div class="detail-section" style="background:#fef3c7;border-color:#f59e0b;">';
  html += '<h2 style="color:#78350f;">⚠️ 重要提示</h2>';
  html += '<p>本页面信息仅供参考,不构成医疗建议。是否参与临床试验,请务必咨询您的主治医生。</p>';
  html += '<p>试验信息可能变更,实际参与条件请以 <a href="' + escapeHtml(trial.source_url) + '" target="_blank">ClinicalTrials.gov 官方页面</a> 为准。</p>';
  html += '</div>';

  detailEl.innerHTML = html;
}

function fieldRow(label, value) {
  if (!value) return '';
  return '<tr><th>' + escapeHtml(label) + '</th><td>' + escapeHtml(value) + '</td></tr>';
}

function showError(title, message) {
  const detailEl = document.getElementById('trial-detail');
  detailEl.innerHTML = '<div class="detail-error"><h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(message) + '</p><p style="margin-top:1rem;"><a href="index.html">返回首页</a></p></div>';
}

function copyShareLink(nctId) {
  const url = window.location.origin + '/trial.html?nct=' + nctId;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      alert('分享链接已复制:\n' + url);
    }).catch(() => {
      prompt('请手动复制链接:', url);
    });
  } else {
    prompt('请手动复制链接:', url);
  }
}