<!-- +page.svelte (home) - MemoFlow 首页时间线 -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { memos, memoFilter } from '$lib/stores/memos';
  import { tags } from '$lib/stores/tags';
  import { ui } from '$lib/stores/ui';
  import { goto } from '$app/navigation';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import MemoEditor from '$lib/components/MemoEditor.svelte';
  import MemoList from '$lib/components/MemoList.svelte';
  import SearchModal from '$lib/components/SearchModal.svelte';
  import { fade, fly } from 'svelte/transition';
  
  // 移动端输入框浮层显隐
  let showMobileEditor = $state(false);

  // 挂载时初始化状态
  onMount(() => {
    auth.init();

    const unsubscribe = auth.subscribe(state => {
      if (!state.loading && !state.isAuthenticated) {
        goto('/login');
      } else if (state.isAuthenticated) {
        // 获取数据
        memos.fetchMemos();
        tags.fetchTags();
      }
    });

    return unsubscribe;
  });

  // 搜索关键字绑定的本地状态，同步到 store 中以实现防抖或即时搜索
  let searchInput = $state('');

  $effect(() => {
    // 监听 searchInput 变化并更新 store 筛选
    memoFilter.update(f => ({ ...f, search: searchInput }));
  });

  // 清除特定的筛选条件
  function clearTagFilter() {
    memoFilter.update(f => ({ ...f, tag: null }));
  }

  function clearSpecialFilter() {
    memoFilter.update(f => ({ ...f, specialFilter: null }));
  }

  // 清除搜索条件
  function clearSearchFilter() {
    searchInput = '';
    memoFilter.update(f => ({ ...f, search: null }));
  }

  // 映射特殊过滤条件的中文名称
  const specialFilterNames = {
    has_image: '有图片',
    has_audio: '有语音',
    has_link: '有链接',
    no_tag: '无标签'
  };
</script>

<div class="app-layout">
  <!-- 移动端侧边栏背景遮罩 -->
  {#if $ui.sidebarOpen}
    <div class="sidebar-backdrop" onclick={() => ui.setSidebar(false)} role="presentation"></div>
  {/if}

  <!-- 左侧导航侧边栏 -->
  <Sidebar />

  <!-- 主体时间线工作区 -->
  <main class="main-content">
    <!-- 顶栏：PC端与手机端响应式分流展示 -->
    
    <!-- 1. 桌面端特有长条搜索顶栏 -->
    <header class="timeline-header desktop-header">
      <button class="menu-toggle-btn card" onclick={() => ui.toggleSidebar()} title="展开导航">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>

      <div 
        class="search-bar card" 
        onclick={() => ui.setSearch(true)} 
        role="button" 
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && ui.setSearch(true)}
      >
        <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input 
          type="text" 
          placeholder="搜索笔记内容或标签... (Ctrl+K)" 
          value={$memoFilter.search || ''} 
          readonly
          style="cursor: pointer;"
        />
        {#if $memoFilter.search}
          <button class="clear-search-btn" onclick={(e) => { e.stopPropagation(); clearSearchFilter(); }} title="清空搜索">✕</button>
        {/if}
      </div>
    </header>

    <!-- 2. 移动端 1:1 原版复刻顶栏 -->
    <header class="timeline-header mobile-header">
      <button class="icon-circle-btn" onclick={() => ui.toggleSidebar()} title="展开侧边栏">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
      </button>
      
      <div class="brand-title">
        <span>flomo</span>
        <svg class="dropdown-arrow" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
      
      <button class="icon-circle-btn" onclick={() => ui.setSearch(true)} title="全局搜索">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      </button>
    </header>

    <!-- 3. 移动端特有快捷功能导航栏 -->
    <div class="mobile-quick-actions">
      <button class="quick-btn card">
        <span class="icon">🧭</span>
        <span class="label">AI 洞察</span>
        <span class="red-dot"></span>
      </button>
      <button class="quick-btn card">
        <span class="icon">✦</span>
        <span class="label">每日回顾</span>
      </button>
      <button class="quick-btn card">
        <span class="icon">👣</span>
        <span class="label">随机漫步</span>
      </button>
    </div>

    <!-- 当前筛选面包屑 -->
    {#if $memoFilter.tag || $memoFilter.specialFilter || $memoFilter.search}
      <div class="filter-badges-container">
        <span class="tip">正在筛选：</span>
        
        <!-- 标签筛选 badge -->
        {#if $memoFilter.tag}
          <div class="filter-badge">
            <span>#{$memoFilter.tag}</span>
            <button class="remove-btn" onclick={clearTagFilter}>✕</button>
          </div>
        {/if}

        <!-- 特殊过滤 badge -->
        {#if $memoFilter.specialFilter}
          <div class="filter-badge">
            <span>{specialFilterNames[$memoFilter.specialFilter]}</span>
            <button class="remove-btn" onclick={clearSpecialFilter}>✕</button>
          </div>
        {/if}

        <!-- 搜索条件 badge -->
        {#if $memoFilter.search}
          <div class="filter-badge">
            <span>搜索: {$memoFilter.search}</span>
            <button class="remove-btn" onclick={clearSearchFilter}>✕</button>
          </div>
        {/if}
      </div>
    {/if}

    <!-- 时间线主内容区 -->
    <div class="timeline-container">
      <!-- 笔记发布框 (仅在桌面端常驻，移动端改由悬浮按钮调起) -->
      <div class="desktop-editor-wrapper">
        <MemoEditor />
      </div>

      <!-- 笔记流列表 -->
      <MemoList />
    </div>
  </main>
</div>

<!-- 4. 手机端绿色浮动添加按钮 (FAB) -->
<button class="floating-add-btn" onclick={() => showMobileEditor = true} title="写卡片">
  <svg viewBox="0 0 24 24" width="24" height="24" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
</button>

<!-- 5. 手机端底部滑入便签编辑器 (Drawer) -->
{#if showMobileEditor}
  <div class="drawer-backdrop" onclick={() => showMobileEditor = false} transition:fade={{ duration: 120 }} role="presentation"></div>
  <div class="drawer-content card" transition:fly={{ y: 450, duration: 250 }}>
    <div class="drawer-header flex justify-between align-center">
      <h3>新建便签</h3>
      <button class="close-drawer-btn" onclick={() => showMobileEditor = false}>✕</button>
    </div>
    <div class="drawer-body">
      <MemoEditor onsaved={() => showMobileEditor = false} />
    </div>
  </div>
{/if}

<!-- 全局快捷搜索组件 -->
<SearchModal />

<style>
  .app-layout {
    display: flex;
    min-height: 100vh;
    background-color: var(--color-bg);
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-lg);
    overflow-y: auto;
    max-width: var(--max-width);
    margin: 0 auto;
    width: 100%;
  }

  /* 顶栏搜索框 */
  .timeline-header {
    margin-bottom: var(--spacing-base);
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .search-bar {
    display: flex;
    align-items: center;
    width: 100%;
    max-width: 640px;
    padding: 0 var(--spacing-base);
    height: 40px;
    gap: var(--spacing-sm);
    box-shadow: var(--shadow-sm);
  }

  .search-icon {
    color: var(--color-text-secondary);
  }

  .search-bar input {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    font-size: var(--fs-base);
    color: var(--color-text);
  }

  .search-bar input::placeholder {
    color: var(--color-text-placeholder);
  }

  .clear-search-btn {
    border: none;
    background: transparent;
    color: var(--color-text-secondary);
    font-size: var(--fs-xs);
    cursor: pointer;
    padding: var(--spacing-xs);
  }

  .clear-search-btn:hover {
    color: var(--color-text);
  }

  /* 筛选面包屑 */
  .filter-badges-container {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-base);
    max-width: 640px;
    width: 100%;
    margin-left: auto;
    margin-right: auto;
  }

  .filter-badges-container .tip {
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
  }

  .filter-badge {
    background-color: var(--color-primary-light);
    color: var(--color-primary);
    border: 1px solid rgba(43, 190, 115, 0.2);
    border-radius: var(--radius-sm);
    padding: 2px var(--spacing-sm);
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .filter-badge .remove-btn {
    border: none;
    background: transparent;
    color: var(--color-primary);
    cursor: pointer;
    font-size: 10px;
    padding: 0 2px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .filter-badge .remove-btn:hover {
    background-color: rgba(43, 190, 115, 0.1);
    border-radius: var(--radius-round);
  }

  /* 时间线容器 */
  .timeline-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    max-width: 640px;
    width: 100%;
    margin: 0 auto;
  }

  /* 汉堡菜单按钮样式 */
  .menu-toggle-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    background-color: var(--color-card);
    color: var(--color-text-secondary);
    cursor: pointer;
    box-shadow: var(--shadow-sm);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }

  .menu-toggle-btn:hover {
    color: var(--color-text);
    border-color: var(--color-border-hover);
  }

  /* 侧边栏遮罩 */
  .sidebar-backdrop {
    display: none;
  }

  /* 手机/移动端适配样式 */
  @media (max-width: 768px) {
    .main-content {
      padding: var(--spacing-base) var(--spacing-sm);
    }

    .timeline-header {
      gap: var(--spacing-sm);
    }

    .menu-toggle-btn {
      display: flex;
    }

    .sidebar-backdrop {
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(2px);
      z-index: 1005;
    }

    /* 限制输入框和卡片在小屏下两边不留过多白 */
    .timeline-container, .timeline-header, .filter-badges-container {
      max-width: 100%;
    }
  }

  /* 桌面/移动端元素响应式显示切换 */
  .desktop-header {
    display: flex;
  }
  .mobile-header {
    display: none;
  }
  .mobile-quick-actions {
    display: none;
  }
  .desktop-editor-wrapper {
    display: block;
  }
  .floating-add-btn {
    display: none;
  }
  .drawer-backdrop {
    display: none;
  }

  @media (max-width: 768px) {
    .desktop-header {
      display: none !important;
    }
    
    .mobile-header {
      display: flex !important;
      align-items: center;
      justify-content: space-between;
      width: calc(100% + 16px) !important;
      margin-left: -8px !important;
      margin-right: -8px !important;
      height: 50px;
      padding: 0 var(--spacing-base);
      border: none !important;
      border-bottom: 1px solid #E8E8E8 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      background-color: var(--color-card);
      margin-bottom: 0 !important;
      position: sticky;
      top: -8px;
      z-index: 999;
    }

    .icon-circle-btn {
      width: 34px;
      height: 34px;
      border-radius: 50% !important;
      background-color: #F1F3F5 !important;
      border: none;
      color: var(--color-text);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color var(--transition-fast);
    }
    .icon-circle-btn:active {
      background-color: var(--color-border);
    }

    .brand-title {
      font-size: var(--fs-md);
      font-weight: var(--fw-semibold);
      color: var(--color-text);
      display: flex;
      align-items: center;
      gap: 3px;
    }
    
    .dropdown-arrow {
      color: var(--color-text-secondary);
      margin-top: 2px;
    }

    /* 快捷选项栏 (1:1 居中与圆角药丸自适应宽度) */
    .mobile-quick-actions {
      display: flex !important;
      justify-content: center;
      gap: 10px;
      width: 100%;
      margin-top: 12px !important;
      margin-bottom: 12px !important;
    }

    .quick-btn {
      flex: none !important;          /* 1:1 取消宽度平分，改为自适应 */
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-xs);
      height: 32px;
      padding: 0 14px !important;
      border: 1px solid rgba(0, 0, 0, 0.04) !important;
      background-color: var(--color-card);
      border-radius: var(--radius-round) !important;
      font-size: var(--fs-xs) !important;
      color: #333333;
      position: relative;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02) !important;
    }

    .quick-btn .red-dot {
      width: 5px;
      height: 5px;
      background-color: var(--color-danger);
      border-radius: 50%;
      position: absolute;
      top: 6px;
      right: 8px;
    }

    .desktop-editor-wrapper {
      display: none !important;
    }

    /* 底部绿色悬浮 + 号 (1:1 还原为圆角正方形 FAB) */
    .floating-add-btn {
      display: flex !important;
      align-items: center;
      justify-content: center;
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      width: 50px;                               /* 1:1 调小尺寸 */
      height: 50px;                              /* 1:1 调小尺寸 */
      border-radius: 16px !important;            /* 1:1 改为高圆角正方形 */
      background-color: var(--color-primary);
      box-shadow: 0 4px 14px rgba(43, 190, 115, 0.4);
      border: none;
      z-index: 999;
      cursor: pointer;
      transition: background-color var(--transition-fast), transform var(--transition-fast);
    }
    .floating-add-btn:active {
      transform: translateX(-50%) scale(0.92);
      background-color: var(--color-primary-hover);
    }

    /* 编辑器 Drawer */
    .drawer-backdrop {
      display: block !important;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(1.5px);
      z-index: 1008;
    }

    .drawer-content {
      display: flex !important;
      flex-direction: column;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background-color: var(--color-card);
      border-top-left-radius: var(--radius-lg);
      border-top-right-radius: var(--radius-lg);
      z-index: 1009;
      box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.15);
      padding: var(--spacing-base);
      max-height: 85vh;
    }

    .drawer-header {
      margin-bottom: var(--spacing-sm);
      border-bottom: 1px solid var(--color-border);
      padding-bottom: var(--spacing-sm);
    }
    .drawer-header h3 {
      font-size: var(--fs-md);
      font-weight: var(--fw-semibold);
      color: var(--color-text);
    }

    .close-drawer-btn {
      font-size: var(--fs-md);
      color: var(--color-text-secondary);
      border: none;
      background: none;
      cursor: pointer;
    }

    .drawer-body {
      overflow-y: auto;
      flex: 1;
      padding-top: var(--spacing-xs);
    }
  }
</style>
