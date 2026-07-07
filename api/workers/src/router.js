/**
 * EasyTrail API 路由
 * ====================
 *
 * 接口列表:
 *   GET  /api/health                  健康检查
 *   GET  /api/stats                   数据库统计
 *   GET  /api/trials                  搜索试验(关键词+筛选)
 *   GET  /api/trials/:nct_id          获取单条试验详情
 *   GET  /api/trials/:nct_id/locations 获取试验的地点列表
 *   GET  /api/facets                  获取筛选维度的可选值
 *   GET  /api/conditions              疾病/癌种列表
 *   GET  /api/sponsors                申办方列表
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=60',
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...CORS_HEADERS, ...extraHeaders },
  });
}

function error(message, status = 400) {
  return json({ error: message, status }, status);
}

async function handleHealth(request, env) {
  const result = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM trials"
  ).first();
  return json({
    status: 'ok',
    service: 'easytrail-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    db: {
      trials_count: result?.cnt || 0,
    },
  });
}

async function handleStats(request, env) {
  const totalTrials = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM trials"
  ).first();

  const recruitingCount = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM trials WHERE overall_status='RECRUITING'"
  ).first();

  const totalLocations = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM trial_locations"
  ).first();

  const lastSync = await env.DB.prepare(
    "SELECT sync_time, trials_inserted, trials_updated FROM sync_log ORDER BY sync_time DESC LIMIT 1"
  ).first();

  return json({
    trials_total: totalTrials?.cnt || 0,
    trials_recruiting: recruitingCount?.cnt || 0,
    locations_total: totalLocations?.cnt || 0,
    last_sync: lastSync || null,
  });
}

async function handleSearch(request, env) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const q = params.get('q') || '';
  const condition = params.get('condition') || '';
  const phase = params.get('phase') || '';
  const status = params.get('status') || 'RECRUITING';
  const country = params.get('country') || '';
  const limit = Math.min(parseInt(params.get('limit') || '50'), 200);
  const offset = parseInt(params.get('offset') || '0');

  // 构造 SQL
  let where = [];
  let binds = [];

  if (status) {
    where.push("t.overall_status = ?");
    binds.push(status);
  }

  if (condition) {
    where.push("t.conditions LIKE ?");
    binds.push(`%${condition}%`);
  }

  if (phase) {
    where.push("t.phases LIKE ?");
    binds.push(`%${phase}%`);
  }

  if (country) {
    where.push(`EXISTS (
      SELECT 1 FROM trial_locations l
      WHERE l.nct_id = t.nct_id AND l.country LIKE ?
    )`);
    binds.push(`%${country}%`);
  }

  // 全文搜索(关键词)
  if (q) {
    where.push(`t.nct_id IN (
      SELECT nct_id FROM trials_fts
      WHERE trials_fts MATCH ?
      LIMIT 1000
    )`);
    binds.push(q);
  }

  const whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";

  const sql = `
    SELECT
      t.nct_id, t.brief_title, t.official_title,
      t.overall_status, t.conditions, t.phases,
      t.study_type, t.lead_sponsor,
      t.enrollment_count, t.primary_completion_date,
      t.last_update_date, t.source_url,
      (SELECT COUNT(*) FROM trial_locations WHERE nct_id = t.nct_id) AS location_count
    FROM trials t
    ${whereClause}
    ORDER BY t.last_update_date DESC
    LIMIT ? OFFSET ?
  `;

  binds.push(limit, offset);

  const result = await env.DB.prepare(sql).bind(...binds).all();
  const trials = result.results || [];

  // 解析 JSON 字段
  const formatted = trials.map(t => ({
    ...t,
    conditions: safeJsonParse(t.conditions, []),
    phases: safeJsonParse(t.phases, []),
  }));

  return json({
    total: formatted.length,
    limit,
    offset,
    query: { q, condition, phase, status, country },
    trials: formatted,
  });
}

async function handleGetTrial(request, env, nctId) {
  if (!nctId || !/^NCT\d{8}$/.test(nctId)) {
    return error('Invalid NCT ID format', 400);
  }

  const trial = await env.DB.prepare(
    "SELECT * FROM trials WHERE nct_id = ?"
  ).bind(nctId).first();

  if (!trial) {
    return error('Trial not found', 404);
  }

  const locations = await env.DB.prepare(
    "SELECT facility, city, state, country, status FROM trial_locations WHERE nct_id = ?"
  ).bind(nctId).all();

  return json({
    ...trial,
    conditions: safeJsonParse(trial.conditions, []),
    phases: safeJsonParse(trial.phases, []),
    intervention_names: safeJsonParse(trial.intervention_names, []),
    intervention_types: safeJsonParse(trial.intervention_types, []),
    locations: locations.results || [],
  });
}

async function handleGetLocations(request, env, nctId) {
  if (!nctId || !/^NCT\d{8}$/.test(nctId)) {
    return error('Invalid NCT ID format', 400);
  }

  const result = await env.DB.prepare(
    "SELECT facility, city, state, country, status FROM trial_locations WHERE nct_id = ? ORDER BY country, city"
  ).bind(nctId).all();

  return json({
    nct_id: nctId,
    count: result.results?.length || 0,
    locations: result.results || [],
  });
}

async function handleFacets(request, env) {
  // 返回常用筛选维度的可选值
  return json({
    statuses: [
      { value: 'RECRUITING', label: '招募中' },
      { value: 'ACTIVE_NOT_RECRUITING', label: '进行中(暂停招募)' },
      { value: 'NOT_YET_RECRUITING', label: '尚未招募' },
      { value: 'COMPLETED', label: '已完成' },
      { value: 'TERMINATED', label: '已终止' },
      { value: 'SUSPENDED', label: '已暂停' },
    ],
    phases: [
      { value: 'PHASE1', label: 'I 期' },
      { value: 'PHASE2', label: 'II 期' },
      { value: 'PHASE3', label: 'III 期' },
      { value: 'PHASE4', label: 'IV 期' },
      { value: 'NA', label: '不适用' },
    ],
    study_types: [
      { value: 'INTERVENTIONAL', label: '干预性研究' },
      { value: 'OBSERVATIONAL', label: '观察性研究' },
      { value: 'EXPANDED_ACCESS', label: '拓展性应用' },
    ],
    common_conditions: [
      '肺癌', '肝癌', '胃癌', '乳腺癌', '结直肠癌',
      '食管癌', '胰腺癌', '白血病', '淋巴瘤', '脑瘤',
      '卵巢癌', '宫颈癌', '前列腺癌', '肾癌', '膀胱癌',
      '黑色素瘤', '甲状腺癌', '鼻咽癌',
    ],
  });
}

function safeJsonParse(str, defaultValue) {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

// ============================================================
// 路由分发
// ============================================================

export async function router(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // 只接受 GET 请求
  if (method !== 'GET') {
    return error('Method not allowed', 405);
  }

  try {
    // 健康检查
    if (path === '/api/health') {
      return await handleHealth(request, env);
    }

    // 统计
    if (path === '/api/stats') {
      return await handleStats(request, env);
    }

    // 试验搜索
    if (path === '/api/trials' || path === '/api/trials/') {
      return await handleSearch(request, env);
    }

    // 单条试验详情
    const trialMatch = path.match(/^\/api\/trials\/(NCT\d{8})$/);
    if (trialMatch) {
      return await handleGetTrial(request, env, trialMatch[1]);
    }

    // 试验地点
    const locMatch = path.match(/^\/api\/trials\/(NCT\d{8})\/locations$/);
    if (locMatch) {
      return await handleGetLocations(request, env, locMatch[1]);
    }

    // 筛选维度
    if (path === '/api/facets') {
      return await handleFacets(request, env);
    }

    // 404
    return error('Not found', 404);

  } catch (err) {
    console.error('API error:', err);
    return json({
      error: 'Internal server error',
      message: err.message,
    }, 500);
  }
}