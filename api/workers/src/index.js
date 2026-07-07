/**
 * EasyTrail API 主入口
 * Cloudflare Workers + D1 数据库
 *
 * 提供 RESTful API 接口给前端调用
 */

import { router } from './router.js';

export default {
  async fetch(request, env, ctx) {
    return router(request, env, ctx);
  },
};