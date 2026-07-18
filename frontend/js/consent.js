/**
 * R1 入口弹窗 - 用户"已知悉"风险提示
 * 用 sessionStorage 记"已确认"(关浏览器就清空, 重新开浏览器会再弹)
 * 用户点"我已阅读并知悉" → POST /api/consent → 写入后端 consent_log
 *
 * 设计原则:
 * - 弹窗不能跳过(必须点已知悉才能浏览)
 * - 记录时间戳(IP/UA 后端拿),作为法律证据链
 * - sessionStorage (关浏览器再开就清空) → 防止一台电脑不同人用, 避免后使用者不知道风险
 * - 站内跳转 / 刷新 tab 不弹 (不烦)
 * - 后端 page_visit 中间件自动记录每次访问 (无需前端操作)
 */

const CONSENT_KEY = 'easytrail_session_ack';
const CONSENT_VERSION = 'v1.0';

function isConsented() {
  try {
    return sessionStorage.getItem(CONSENT_KEY) === CONSENT_VERSION;
  } catch { return false; }
}

function recordLocalConsent() {
  try {
    sessionStorage.setItem(CONSENT_KEY, CONSENT_VERSION);
  } catch {}
}

function showConsentModal() {
  if (document.getElementById('consent-modal-mask')) return; // 避免重复

  const mask = document.createElement('div');
  mask.id = 'consent-modal-mask';
  mask.className = 'consent-modal-mask';
  mask.innerHTML = `
    <div class="consent-modal" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div class="consent-modal-header">
        <span class="consent-modal-icon">⚠️</span>
        <h2 class="consent-modal-title" id="consent-title">使用前必读 · 风险提示</h2>
      </div>
      <div class="consent-modal-body">
        <p>本工具数据来源于 <strong>ClinicalTrials.gov</strong>(美国国立卫生研究院公开数据库)。数据可能<strong>滞后、不完整或存在错误</strong>,翻译与自动化处理可能引入偏差。</p>
        <p><strong>本工具不提供医疗建议</strong>,不能替代医生诊断。参与临床试验前,你必须:</p>
        <ul>
          <li>咨询主治医生,评估是否适合</li>
          <li>致电试验方或医院,确认最新招募信息</li>
          <li>签署试验方提供的知情同意书</li>
        </ul>
        <p style="font-size:0.82rem;color:#6b7280;margin-top:0.5rem;">使用本工具即视为已阅读、知悉上述风险。详见 <a href="legal/user-agreement.html" target="_blank">用户协议</a> · <a href="legal/privacy-policy.html" target="_blank">隐私政策</a></p>
      </div>
      <div class="consent-modal-footer">
        <button class="consent-modal-button primary" id="consent-accept">我已阅读并知悉,继续使用</button>
      </div>
    </div>
  `;
  document.body.appendChild(mask);
  document.body.style.overflow = 'hidden';

  document.getElementById('consent-accept').addEventListener('click', async () => {
    const btn = document.getElementById('consent-accept');
    btn.disabled = true;
    btn.textContent = '记录中...';
    try {
      // 写后端证据链(IP/UA 由后端从 header 拿)
      await fetch(API_BASE + '/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: CONSENT_VERSION }),
      });
    } catch (e) {
      console.warn('[consent] 后端记录失败,继续:', e);
    }
    // sessionStorage 记 (关浏览器就清空, 防一台电脑多人用)
    recordLocalConsent();
    hideConsentModal();
  });
}

function hideConsentModal() {
  const mask = document.getElementById('consent-modal-mask');
  if (mask) mask.remove();
  document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', () => {
  // sessionStorage 记 (关浏览器再开就清空)
  setTimeout(() => {
    if (!isConsented()) {
      showConsentModal();
    }
  }, 100);
});
