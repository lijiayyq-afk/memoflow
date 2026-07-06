/* api.ts - 统一的前端 API 请求工具，支持 Token 自动挂载与 401 拦截 */

import { browser } from '$app/environment';

// 默认 API 前缀，Workers 环境下通常与 SvelteKit 同域部署在 /api 下
const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  info: any;

  constructor(message: string, status: number, info?: any) {
    super(message);
    this.status = status;
    this.info = info;
  }
}

/**
 * 通用的 fetch 封装
 */
export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;

  // 组装 Headers
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // 自动从 localStorage 中注入 Token
  if (browser) {
    const token = localStorage.getItem('memoflow_token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  // 处理 401 Unauthorized，跳转到登录或清空状态
  if (response.status === 401 && browser) {
    localStorage.removeItem('memoflow_token');
    localStorage.removeItem('memoflow_user');
    // 可以触发页面刷新或通知 auth store
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  if (!response.ok) {
    let errorInfo;
    try {
      errorInfo = await response.json();
    } catch {
      errorInfo = { message: '请求失败' };
    }
    throw new ApiError(
      errorInfo.message || `HTTP Error ${response.status}`,
      response.status,
      errorInfo
    );
  }

  // 处理 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
