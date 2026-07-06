<!-- Sidebar.svelte - MemoFlow 导航侧边栏组件 -->
<script lang="ts">
  import { auth } from '$lib/stores/auth';
  import { memos, memoFilter } from '$lib/stores/memos';
  import { tags } from '$lib/stores/tags';
  import Heatmap from './Heatmap.svelte';
  import TagTree from './TagTree.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  // 计算使用天数
  let daysUsed = $derived.by(() => {
    if (!$auth.user) return 1;
    const createdAtVal = $auth.user.createdAt;
    // 兼容数字或字符串
    const regTimestamp = typeof createdAtVal === 'number' 
      ? createdAtVal 
      : (Number(createdAtVal) || Date.parse(createdAtVal) || Date.now());
      
    const diffMs = Math.abs(Date.now() - regTimestamp);
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays || 1;
  });

  // 统计数据
  let activeMemoCount = $derived($memos.items.filter(m => !m.isArchived).length);
  let tagCount = $derived(Object.keys($tags.tagsMap).length);

  // 退出登录
  function handleLogout() {
    auth.logout();
    goto('/login');
  }

  // 特殊过滤器切换
  function selectSpecialFilter(type: 'has_image' | 'has_audio' | 'has_link' | 'no_tag' | null) {
    // 如果已经在首页，直接更新 filter，否则跳转到首页再设置 filter
    if ($page.url.pathname !== '/') {
      goto('/').then(() => {
        memoFilter.update(f => ({
          ...f,
          tag: null,
          specialFilter: type
        }));
      });
    } else {
      memoFilter.update(f => ({
        ...f,
        // 清除普通的标签筛选以防冲突
        tag: null,
        specialFilter: $memoFilter.specialFilter === type ? null : type
      }));
    }
  }

  // 清空所有筛选条件并回到主时间线
  function clearAllFilters() {
    memoFilter.set({
      tag: null,
      search: null,
      onlyPinned: false,
      onlyArchived: false,
      dateRange: null,
      specialFilter: null
    });
    if ($page.url.pathname !== '/') {
      goto('/');
    }
  }

  // 用户下拉菜单开关
  let userMenuOpen = $state(false);
</script>

<aside class="sidebar-aside" class:open={$ui.sidebarOpen}>
  <!-- 头部：用户信息 -->
  <div class="user-profile-section">
    <div 
      class="user-info-card" 
      onclick={() => userMenuOpen = !userMenuOpen}
      onkeydown={(e) => e.key === 'Enter' && (userMenuOpen = !userMenuOpen)}
      role="button" 
      tabindex="0"
    >
      <div class="avatar">
        {#if $auth.user?.avatar}
          <img src={$auth.user.avatar} alt="头像" />
        {:else}
          <div class="avatar-fallback">
            {($auth.user?.username || 'M').substring(0, 1).toUpperCase()}
          </div>
        {/if}
      </div>
      <div class="user-meta">
        <span class="username">{$auth.user?.username || '未登录用户'}</span>
        <span class="user-status">在线</span>
      </div>
      <svg class="dropdown-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>

      <!-- 用户下拉操作菜单 -->
      {#if userMenuOpen}
        <div class="user-dropdown-menu" onclick={e => e.stopPropagation()} role="presentation">
          <div class="dropdown-header">
            <strong>{$auth.user?.email || '无邮箱信息'}</strong>
          </div>
          <hr />
          <button class="dropdown-item danger" onclick={handleLogout}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            退出登录
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- 滚动区域：统计、热力图、过滤器、标签树 -->
  <div class="sidebar-scrollable-content">
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card" onclick={clearAllFilters} role="button" tabindex="0" onkeydown={e => e.key==='Enter' && clearAllFilters()}>
        <span class="stat-value">{activeMemoCount}</span>
        <span class="stat-label">Memos</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{tagCount}</span>
        <span class="stat-label">标签</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{daysUsed}</span>
        <span class="stat-label">天数</span>
      </div>
    </div>

    <!-- 热力图 -->
    <div class="heatmap-section">
      <Heatmap />
    </div>

    <!-- 快捷过滤器 -->
    <div class="quick-filters-section">
      <div class="section-title">快捷筛选</div>
      <div class="filter-links">
        <button 
          class="filter-link" 
          class:active={$memoFilter.specialFilter === null && $memoFilter.tag === null && $page.url.pathname === '/'} 
          onclick={clearAllFilters}
        >
          <span class="icon">📝</span>
          <span class="name">全部笔记</span>
        </button>
        <button 
          class="filter-link" 
          class:active={$memoFilter.specialFilter === 'has_image'} 
          onclick={() => selectSpecialFilter('has_image')}
        >
          <span class="icon">🖼️</span>
          <span class="name">有图片</span>
        </button>
        <button 
          class="filter-link" 
          class:active={$memoFilter.specialFilter === 'has_audio'} 
          onclick={() => selectSpecialFilter('has_audio')}
        >
          <span class="icon">🎙️</span>
          <span class="name">有语音</span>
        </button>
        <button 
          class="filter-link" 
          class:active={$memoFilter.specialFilter === 'has_link'} 
          onclick={() => selectSpecialFilter('has_link')}
        >
          <span class="icon">🔗</span>
          <span class="name">有链接</span>
        </button>
        <button 
          class="filter-link" 
          class:active={$memoFilter.specialFilter === 'no_tag'} 
          onclick={() => selectSpecialFilter('no_tag')}
        >
          <span class="icon">🏷️</span>
          <span class="name">无标签</span>
        </button>
      </div>
    </div>

    <!-- 标签树 -->
    <div class="tags-tree-section">
      <div class="section-title">标签</div>
      <TagTree />
    </div>
  </div>

  <!-- 底部：固定操作区域 -->
  <div class="sidebar-footer">
    <a href="/trash" class="footer-btn" class:active={$page.url.pathname === '/trash'}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
      回收站
    </a>
    
    <button class="footer-btn" onclick={() => alert('设置页面开发中，敬请期待！')}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
      设置
    </button>
  </div>
</aside>

<style>
  .sidebar-aside {
    width: var(--sidebar-width);
    height: 100vh;
    background-color: var(--color-card);
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    position: sticky;
    top: 0;
    left: 0;
    z-index: 100;
  }

  /* 用户信息区域 */
  .user-profile-section {
    padding: var(--spacing-base);
    border-bottom: 1px solid var(--color-border);
    position: relative;
  }

  .user-info-card {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background-color var(--transition-fast);
    user-select: none;
  }

  .user-info-card:hover {
    background-color: rgba(0, 0, 0, 0.02);
  }

  .avatar {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-round);
    overflow: hidden;
    background-color: var(--color-primary-light);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(43, 190, 115, 0.2);
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-fallback {
    font-size: var(--fs-md);
    font-weight: var(--fw-bold);
    color: var(--color-primary);
  }

  .user-meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .username {
    font-size: var(--fs-base);
    font-weight: var(--fw-semibold);
    color: var(--color-text);
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  .user-status {
    font-size: var(--fs-xs);
    color: var(--color-primary);
  }

  .dropdown-icon {
    color: var(--color-text-secondary);
  }

  /* 下拉菜单 */
  .user-dropdown-menu {
    position: absolute;
    top: calc(100% - var(--spacing-xs));
    left: var(--spacing-base);
    right: var(--spacing-base);
    background-color: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    padding: var(--spacing-xs) 0;
    animation: slideDown var(--transition-fast) forwards;
  }

  .dropdown-header {
    padding: var(--spacing-sm) var(--spacing-base);
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
    word-break: break-all;
  }

  .user-dropdown-menu hr {
    border: none;
    border-top: 1px solid var(--color-border);
    margin: var(--spacing-xs) 0;
  }

  .dropdown-item {
    width: 100%;
    background: none;
    border: none;
    padding: var(--spacing-sm) var(--spacing-base);
    font-size: var(--fs-sm);
    color: var(--color-text);
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    transition: background-color var(--transition-fast);
  }

  .dropdown-item:hover {
    background-color: var(--color-bg);
  }

  .dropdown-item.danger {
    color: var(--color-danger);
  }

  .dropdown-item.danger:hover {
    background-color: var(--color-danger-light);
  }

  /* 滚动内容区 */
  .sidebar-scrollable-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-base);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    scrollbar-width: thin;
  }

  /* 统计区 */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-sm);
  }

  .stat-card {
    background-color: var(--color-bg);
    padding: var(--spacing-sm) var(--spacing-xs);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color var(--transition-fast), transform var(--transition-fast);
    border: 1px solid transparent;
  }

  .stat-card:hover {
    background-color: rgba(43, 190, 115, 0.05);
    border-color: rgba(43, 190, 115, 0.15);
    transform: translateY(-1px);
  }

  .stat-value {
    font-size: var(--fs-md);
    font-weight: var(--fw-bold);
    color: var(--color-text);
  }

  .stat-label {
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
    margin-top: 2px;
  }

  /* 快捷过滤器 */
  .quick-filters-section, .tags-tree-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .section-title {
    font-size: var(--fs-xs);
    font-weight: var(--fw-semibold);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding-left: var(--spacing-xs);
  }

  .filter-links {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .filter-link {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-sm);
    background: none;
    border: none;
    text-align: left;
    color: var(--color-text);
    cursor: pointer;
    font-size: var(--fs-sm);
    transition: background-color var(--transition-fast), color var(--transition-fast);
  }

  .filter-link:hover {
    background-color: rgba(0, 0, 0, 0.02);
  }

  .filter-link.active {
    background-color: var(--color-primary-light);
    color: var(--color-primary);
    font-weight: var(--fw-semibold);
  }

  .filter-link .icon {
    font-size: var(--fs-md);
  }

  /* 底部固定区域 */
  .sidebar-footer {
    padding: var(--spacing-sm) var(--spacing-base);
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-sm);
    background-color: var(--color-card);
  }

  .footer-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-xs);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-card);
    color: var(--color-text-secondary);
    font-size: var(--fs-xs);
    cursor: pointer;
    text-decoration: none;
    transition: all var(--transition-fast);
  }

  .footer-btn:hover {
    border-color: var(--color-border-hover);
    color: var(--color-text);
    background-color: var(--color-bg);
  }

  .footer-btn.active {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background-color: var(--color-primary-light);
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* 移动端/手机端滑入侧边栏适配 */
  @media (max-width: 768px) {
    .sidebar-aside {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: 280px;
      z-index: 1010;
      transform: translateX(-100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: none;
      border-right: 1px solid var(--color-border);
    }

    .sidebar-aside.open {
      transform: translateX(0);
      box-shadow: var(--shadow-xl);
    }
  }
</style>
