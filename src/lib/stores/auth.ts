/* auth.ts - 用户认证与个人信息状态管理 Store */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { apiFetch } from '$lib/api';
import type { User } from '$lib/types';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

// 初始状态
const initialState: AuthState = {
  token: null,
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null
};

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(initialState);

  // 从本地存储初始化状态
  function init() {
    if (!browser) return;
    
    try {
      const token = localStorage.getItem('memoflow_token');
      const userJson = localStorage.getItem('memoflow_user');
      
      if (token && userJson) {
        const user = JSON.parse(userJson) as User;
        set({
          token,
          user,
          isAuthenticated: true,
          loading: false,
          error: null
        });
        // 异步拉取最新用户信息以保证同步
        refreshProfile();
      }
    } catch (e) {
      console.error('初始化 auth 状态失败:', e);
      logout();
    }
  }

  // 刷新当前用户信息
  async function refreshProfile() {
    try {
      const user = await apiFetch<User>('/auth/me');
      update(state => {
        if (state.token) {
          localStorage.setItem('memoflow_user', JSON.stringify(user));
          return { ...state, user, isAuthenticated: true };
        }
        return state;
      });
    } catch (err: any) {
      // 如果获取失败，且是 401，由 api.ts 的拦截器处理
      console.error('刷新用户信息失败:', err);
    }
  }

  // 注册
  async function register(username: string, email: string, password: string) {
    update(s => ({ ...s, loading: true, error: null }));
    try {
      const result = await apiFetch<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password })
      });

      if (browser) {
        localStorage.setItem('memoflow_token', result.token);
        localStorage.setItem('memoflow_user', JSON.stringify(result.user));
      }

      set({
        token: result.token,
        user: result.user,
        isAuthenticated: true,
        loading: false,
        error: null
      });
    } catch (err: any) {
      update(s => ({ ...s, loading: false, error: err.message || '注册失败' }));
      throw err;
    }
  }

  // 登录
  async function login(username: string, password: string) {
    update(s => ({ ...s, loading: true, error: null }));
    try {
      const result = await apiFetch<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      if (browser) {
        localStorage.setItem('memoflow_token', result.token);
        localStorage.setItem('memoflow_user', JSON.stringify(result.user));
      }

      set({
        token: result.token,
        user: result.user,
        isAuthenticated: true,
        loading: false,
        error: null
      });
    } catch (err: any) {
      update(s => ({ ...s, loading: false, error: err.message || '登录失败' }));
      throw err;
    }
  }

  // 退出登录
  function logout() {
    if (browser) {
      localStorage.removeItem('memoflow_token');
      localStorage.removeItem('memoflow_user');
    }
    set(initialState);
  }

  // 更新个人信息
  async function updateProfile(data: { username?: string; email?: string; avatar?: string }) {
    update(s => ({ ...s, loading: true, error: null }));
    try {
      const updatedUser = await apiFetch<User>('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(data)
      });

      if (browser) {
        localStorage.setItem('memoflow_user', JSON.stringify(updatedUser));
      }

      update(s => ({
        ...s,
        user: updatedUser,
        loading: false
      }));
    } catch (err: any) {
      update(s => ({ ...s, loading: false, error: err.message || '更新个人信息失败' }));
      throw err;
    }
  }

  // 监听未授权事件
  if (browser) {
    window.addEventListener('auth:unauthorized', () => {
      set(initialState);
    });
  }

  return {
    subscribe,
    init,
    register,
    login,
    logout,
    updateProfile,
    refreshProfile
  };
}

export const auth = createAuthStore();
