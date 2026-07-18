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
    const result = await API.getTrial(nctId);
    // API 返回 { success, data: {...} } - 解开 data 包装
    const trial = result.data || result;
    renderTrial(trial);
    document.title = (trial.brief_title || '试验详情') + ' - EasyTrail';
  } catch (err) {
    showError('加载失败', err.message);
  }
}

function renderTrial(trial) {
  const detailEl = document.getElementById('trial-detail');

  // 字段适配: 详情 API 部分字段名跟前端期望不一致
  const phaseLabel = formatPhase(trial.phase || trial.phases);
  // condition 优先用中文 condition_zh, fallback conditions array, 最后 condition string
  let conditionList = [];
  if (typeof trial.condition_zh === 'string' && trial.condition_zh.trim()) {
    conditionList = trial.condition_zh.split(/[;,、]/).map(s => s.trim()).filter(Boolean);
  } else if (Array.isArray(trial.conditions)) {
    conditionList = trial.conditions;
  } else if (typeof trial.condition === 'string' && trial.condition) {
    conditionList = trial.condition.split(/[;,、]/).map(s => s.trim()).filter(Boolean);
  }
  // interventions 可能是 array of {intervention, intervention_type}
  let interventionNames = [];
  let interventionTypes = [];
  if (Array.isArray(trial.interventions)) {
    interventionNames = trial.interventions.map(i => i.intervention || i.name).filter(Boolean);
    interventionTypes = trial.interventions.map(i => i.intervention_type || i.type).filter(Boolean);
  } else {
    interventionNames = Array.isArray(trial.intervention_names) ? trial.intervention_names : [];
    interventionTypes = Array.isArray(trial.intervention_types) ? trial.intervention_types : [];
  }

  let html = '';

  // R2: 顶部风险提示框(与 banner 同色系,一页内不滚动)
  html += '<div class="risk-warning-box">';
  html += '<div class="risk-warning-title">⚠️ 本页面信息仅供参考,不构成医疗建议</div>';
  html += '<ul>';
  html += '<li>数据来源于 ClinicalTrials.gov 备案,可能滞后、不完整</li>';
  html += '<li>参与前请咨询主治医生,并致电试验方或医院确认</li>';
  html += '<li>最终条件以试验方知情同意书为准</li>';
  html += '</ul>';
  html += '</div>';

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
  // A5: 置信度标签
  if (trial.confidence) {
    const confClass = 'confidence-' + (trial.confidence || 'basic');
    html += '<span class="confidence-badge ' + confClass + '" title="数据可信度等级">' + escapeHtml(trial.confidence_label || '备案信息') + '</span>';
  }
  if (trial.is_china) {
    html += '<span class="confidence-badge confidence-china" title="本试验有中国分中心">🇨🇳 中国站点</span>';
  }
  html += '</div>';
  html += '<div class="detail-actions">';
  // source_url API 没返回, 用 nct_id 拼 CT.gov 链接
  const sourceUrl = trial.source_url || ('https://clinicaltrials.gov/study/' + trial.nct_id);
  html += '<a href="' + escapeHtml(sourceUrl) + '" target="_blank" rel="noopener" class="detail-button primary">🔗 查看 ClinicalTrials.gov 原文</a>';
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
  if (trial.lead_sponsor || trial.sponsor_name) html += fieldRow('主办方', trial.lead_sponsor || trial.sponsor_name);
  // 已招人数 vs 计划招募
  if (trial.enrollment_actual && trial.enrollment) {
    const pct = Math.round((trial.enrollment_actual / trial.enrollment) * 100);
    html += fieldRow('招募进度', trial.enrollment_actual + ' / ' + trial.enrollment + ' 人 (' + pct + '%)');
  } else if (trial.enrollment_count || trial.enrollment) {
    html += fieldRow('计划招募人数', (trial.enrollment_count || trial.enrollment) + ' 人');
  }
  // 试验日期 - 4 个分开
  if (trial.first_post_date) html += fieldRow('首次公示', formatDate(trial.first_post_date));
  if (trial.start_date) html += fieldRow('开始日期', formatDate(trial.start_date));
  if (trial.primary_completion_date) html += fieldRow('主要完成日期', formatDate(trial.primary_completion_date));
  if (trial.completion_date) html += fieldRow('预计完成日期', formatDate(trial.completion_date));
  if (trial.last_update_date || trial.last_update_posted_date) html += fieldRow('数据更新', formatDate(trial.last_update_date || trial.last_update_posted_date));
  // A5: 置信度说明
  if (trial.confidence) {
    let confDesc = '';
    if (trial.confidence === 'basic') confDesc = '备案信息(可能滞后)';
    else if (trial.confidence === 'medium') confDesc = '已核对至官方注册';
    else if (trial.confidence === 'high') confDesc = '与官方招募信息吻合';
    else if (trial.confidence === 'paid') confDesc = '由企业主动维护';
    html += fieldRow('数据置信度', confDesc + (trial.confidence_reviewed_at ? ' (' + formatDate(trial.confidence_reviewed_at) + ')' : ''));
  }
  html += '</table>';
  html += '</div>';

  // 试验设计
  if (trial.study_design) {
    html += '<div class="detail-section">';
    html += '<h2>试验设计</h2>';
    html += '<table class="field-table">';
    // 把 "分配方式:Randomized; 干预模型:Parallel Assignment; ..." 拆成多行
    const parts = trial.study_design.split(/\s*;\s*/);
    for (const p of parts) {
      const colonIdx = p.indexOf(':');
      if (colonIdx > 0) {
        const k = p.substring(0, colonIdx).trim();
        const v = p.substring(colonIdx + 1).trim();
        if (k && v) html += fieldRow(k, v);
      } else if (p.trim()) {
        html += fieldRow('', p.trim());
      }
    }
    html += '</table>';
    html += '</div>';
  }

  // 主要终点指标
  if (Array.isArray(trial.primary_outcomes) && trial.primary_outcomes.length > 0) {
    html += '<div class="detail-section">';
    html += '<h2>主要终点指标 (' + trial.primary_outcomes.length + ' 项)</h2>';
    for (const o of trial.primary_outcomes) {
      html += '<div class="outcome-item">';
      html += '<div class="outcome-measure">' + escapeHtml(o.measure || '未提供') + '</div>';
      if (o.description) html += '<div class="outcome-desc">' + escapeHtml(o.description) + '</div>';
      if (o.time_frame) html += '<div class="outcome-time">⏱ ' + escapeHtml(o.time_frame) + '</div>';
      html += '</div>';
    }
    html += '</div>';
  }

  // 次要终点指标
  if (Array.isArray(trial.secondary_outcomes) && trial.secondary_outcomes.length > 0) {
    html += '<div class="detail-section">';
    html += '<h2>次要终点指标 (' + trial.secondary_outcomes.length + ' 项)</h2>';
    for (const o of trial.secondary_outcomes) {
      html += '<div class="outcome-item">';
      html += '<div class="outcome-measure">' + escapeHtml(o.measure || '未提供') + '</div>';
      if (o.description) html += '<div class="outcome-desc">' + escapeHtml(o.description) + '</div>';
      if (o.time_frame) html += '<div class="outcome-time">⏱ ' + escapeHtml(o.time_frame) + '</div>';
      html += '</div>';
    }
    html += '</div>';
  }

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
    if (trial.min_age || trial.minimum_age) html += fieldRow('最低年龄', trial.min_age || trial.minimum_age);
    if (trial.max_age || trial.maximum_age) html += fieldRow('最高年龄', trial.max_age || trial.maximum_age);
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

  // R3: 主办方联系信息(关键!让用户自己打电话)
  if (trial.contacts && trial.contacts.total_count > 0) {
    html += '<div class="detail-section contact-section">';
    html += '<h2>📞 主办方联系信息</h2>';
    html += '<p class="contact-hint">建议先致电主办方或医院,确认最新招募信息后再做决定</p>';
    if (trial.contacts.central && trial.contacts.central.length > 0) {
      html += '<h3 class="contact-subtitle">整体联系人</h3>';
      html += '<div class="contact-list">';
      for (const c of trial.contacts.central) {
        html += '<div class="contact-item">';
        if (c.name) html += '<div class="contact-name">' + escapeHtml(c.name) + (c.contact_type ? ' <span class="contact-type">(' + escapeHtml(c.contact_type) + ')</span>' : '') + '</div>';
        if (c.phone) html += '<div class="contact-phone">📞 <a href="tel:' + escapeHtml(c.phone) + '">' + escapeHtml(c.phone) + '</a></div>';
        if (c.email) html += '<div class="contact-email">✉️ <a href="mailto:' + escapeHtml(c.email) + '">' + escapeHtml(c.email) + '</a></div>';
        html += '</div>';
      }
      html += '</div>';
    }
    if (trial.contacts.locations && trial.contacts.locations.length > 0) {
      html += '<h3 class="contact-subtitle">分中心联系人 (' + trial.contacts.locations.length + ' 个)</h3>';
      html += '<div class="contact-list">';
      for (const c of trial.contacts.locations) {
        html += '<div class="contact-item">';
        if (c.facility) html += '<div class="contact-name">' + escapeHtml(c.facility) + '</div>';
        const addr = [c.city, c.country].filter(Boolean).join(', ');
        if (addr) html += '<div class="contact-address">📍 ' + escapeHtml(addr) + '</div>';
        if (c.name) html += '<div>👤 ' + escapeHtml(c.name) + '</div>';
        if (c.phone) html += '<div class="contact-phone">📞 <a href="tel:' + escapeHtml(c.phone) + '">' + escapeHtml(c.phone) + '</a></div>';
        if (c.email) html += '<div class="contact-email">✉️ <a href="mailto:' + escapeHtml(c.email) + '">' + escapeHtml(c.email) + '</a></div>';
        html += '</div>';
      }
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