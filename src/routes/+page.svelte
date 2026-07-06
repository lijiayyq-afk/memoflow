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
    <!-- 顶栏：搜索与状态栏 -->
    <header class="timeline-header">
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
      <!-- 笔记发布框 -->
      <MemoEditor />

      <!-- 笔记流列表 -->
      <MemoList />
    </div>
  </main>
</div>

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
</style>
