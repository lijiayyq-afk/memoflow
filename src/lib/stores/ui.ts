/* ui.ts - 全局 UI 交互与视图状态管理 Store */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// 定义 UI 状态接口
interface UIState {
  sidebarOpen: boolean;          // 侧边栏在移动端的展开/收起，或 PC 端的折叠
  searchActive: boolean;         // 搜索栏是否处于激活输入状态
  theme: 'light' | 'dark';       // 全局色彩主题
  editorFocused: boolean;        // 编辑器是否聚焦
  activeMemoId: string | null;   // 当前选中的笔记 ID（用于双栏模式或移动端阅读页）
  editModalOpen: boolean;        // 编辑弹窗是否开启
  memoDraft: string;             // 正在编辑的草稿（防丢失）
}

const defaultState: UIState = {
  sidebarOpen: true,
  searchActive: false,
  theme: 'light',
  editorFocused: false,
  activeMemoId: null,
  editModalOpen: false,
  memoDraft: ''
};

function createUIStore() {
  let initialTheme: 'light' | 'dark' = 'light';
  let initialDraft = '';
  let initialSidebarOpen = true;
  
  if (browser) {
    initialTheme = (localStorage.getItem('memoflow_theme') as 'light' | 'dark') || 'light';
    initialDraft = localStorage.getItem('memoflow_draft') || '';
    if (window.innerWidth < 768) {
      initialSidebarOpen = false;
    }
    
    // 应用主题 class 到 html 标签上，以便 CSS 变量支持暗色模式
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }

  const { subscribe, set, update } = writable<UIState>({
    ...defaultState,
    theme: initialTheme,
    memoDraft: initialDraft,
    sidebarOpen: initialSidebarOpen
  });

  // 1. 侧边栏操作
  function toggleSidebar() {
    update(s => ({ ...s, sidebarOpen: !s.sidebarOpen }));
  }

  function setSidebar(open: boolean) {
    update(s => ({ ...s, sidebarOpen: open }));
  }

  // 2. 搜索框操作
  function toggleSearch() {
    update(s => ({ ...s, searchActive: !s.searchActive }));
  }

  function setSearch(active: boolean) {
    update(s => ({ ...s, searchActive: active }));
  }

  // 3. 主题操作
  function setTheme(theme: 'light' | 'dark') {
    if (browser) {
      localStorage.setItem('memoflow_theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
    update(s => ({ ...s, theme }));
  }

  function toggleTheme() {
    update(s => {
      const nextTheme = s.theme === 'light' ? 'dark' : 'light';
      if (browser) {
        localStorage.setItem('memoflow_theme', nextTheme);
        document.documentElement.classList.toggle('dark', nextTheme === 'dark');
      }
      return { ...s, theme: nextTheme };
    });
  }

  // 4. 编辑器聚焦与草稿
  function setEditorFocused(focused: boolean) {
    update(s => ({ ...s, editorFocused: focused }));
  }

  function setMemoDraft(draft: string) {
    if (browser) {
      localStorage.setItem('memoflow_draft', draft);
    }
    update(s => ({ ...s, memoDraft: draft }));
  }

  function clearMemoDraft() {
    if (browser) {
      localStorage.removeItem('memoflow_draft');
    }
    update(s => ({ ...s, memoDraft: '' }));
  }

  // 5. 选中笔记
  function setActiveMemoId(id: string | null) {
    update(s => ({ ...s, activeMemoId: id }));
  }

  // 6. 弹窗控制
  function setEditModalOpen(open: boolean) {
    update(s => ({ ...s, editModalOpen: open }));
  }

  // 7. 重置所有 UI 状态
  function reset() {
    set({
      ...defaultState,
      theme: browser ? (localStorage.getItem('memoflow_theme') as 'light' | 'dark' || 'light') : 'light'
    });
  }

  return {
    subscribe,
    toggleSidebar,
    setSidebar,
    toggleSearch,
    setSearch,
    setTheme,
    toggleTheme,
    setEditorFocused,
    setMemoDraft,
    clearMemoDraft,
    setActiveMemoId,
    setEditModalOpen,
    reset
  };
}

export const ui = createUIStore();
