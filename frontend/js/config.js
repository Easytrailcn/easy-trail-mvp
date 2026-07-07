/**
 * EasyTrail 前端配置
 * =====================
 *
 * 部署时修改 API_BASE 为生产环境 API 地址
 */

// API 基础地址
// 开发:本地 wrangler dev 默认端口
// 生产:替换为部署后的 Workers URL
const API_BASE = window.EASYTRAIL_API_BASE || 'https://api.easytrail.cn';

// 每页结果数
const PAGE_SIZE = 20;

// 语言
const LANG = 'zh-CN';