<!-- +page.svelte (trash) - MemoFlow 回收站页面 -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { trash } from '$lib/stores/trash';
  import { goto } from '$app/navigation';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import { ui } from '$lib/stores/ui';

  // 检查登录状态并初始化回收站
  onMount(() => {
    auth.init();
    trash.init();
    
    const unsubscribe = auth.subscribe(state => {
      if (!state.loading && !state.isAuthenticated) {
        goto('/login');
      }
    });

    return unsubscribe;
  });

  // 格式化时间
  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // 恢复笔记
  async function handleRestore(id: string) {
    try {
      await trash.restoreMemo(id);
      alert('已成功恢复笔记');
    } catch (err) {
      alert('恢复笔记失败');
    }
  }

  // 彻底删除
  function handlePermanentDelete(id: string) {
    if (confirm('确认要彻底删除该笔记吗？此操作无法撤销。')) {
      trash.deletePermanently(id);
    }
  }

  // 清空回收站
  function handleClearAll() {
    if (confirm('确认清空回收站吗？所有笔记将彻底消失。')) {
      trash.clearAll();
    }
  }
</script>

<div class="app-layout">
  <!-- 移动端侧边栏背景遮罩 -->
  {#if $ui.sidebarOpen}
    <div class="sidebar-backdrop" onclick={() => ui.setSidebar(false)} role="presentation"></div>
  {/if}

  <!-- 左侧导航侧边栏 -->
  <Sidebar />

  <!-- 主体工作区 -->
  <main class="main-content">
    <!-- 头部区域 -->
    <header class="content-header">
      <button class="menu-toggle-btn card" onclick={() => ui.toggleSidebar()} title="展开导航">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>

      <div class="header-info">
        <h2>回收站</h2>
        <span class="count-tip">共 {$trash.items.length} 条已软删除的笔记</span>
      </div>
      {#if $trash.items.length > 0}
        <button class="clear-btn" onclick={handleClearAll}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          一键清空
        </button>
      {/if}
    </header>

    <!-- 笔记卡片容器 -->
    <div class="trash-timeline">
      {#if $trash.items.length === 0}
        <div class="empty-state card">
          <div class="empty-icon">🗑️</div>
          <h3>回收站空空如也</h3>
          <p>删除的笔记会在此保留，供你需要时一键恢复</p>
        </div>
      {:else}
        {#each $trash.items as item (item.id)}
          <div class="trash-memo-card card">
            <div class="memo-header">
              <span class="memo-time">{formatTime(item.createdAt)}</span>
              
              <div class="memo-actions">
                <button class="action-btn restore" onclick={() => handleRestore(item.id)} title="恢复笔记">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
                  </svg>
                  恢复
                </button>
                <button class="action-btn delete" onclick={() => handlePermanentDelete(item.id)} title="彻底删除">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  彻底删除
                </button>
              </div>
            </div>
            
            <div class="memo-body">
              <p class="memo-text">{item.content}</p>
              
              {#if item.resources && item.resources.length > 0}
                <div class="memo-resources">
                  {#each item.resources as res}
                    <div class="resource-item">
                      {#if res.mimeType.startsWith('image/')}
                        <img src={res.url} alt={res.filename} class="resource-img" />
                      {:else if res.mimeType.startsWith('audio/')}
                        <audio src={res.url} controls class="resource-audio"></audio>
                      {:else}
                        <a href={res.url} target="_blank" class="resource-file">
                          📎 {res.filename}
                        </a>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

            {#if item.tags && item.tags.length > 0}
              <div class="memo-footer">
                <div class="tag-list">
                  {#each item.tags as tag}
                    <span class="tag-badge">#{tag}</span>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  </main>
</div>

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

  .content-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-lg);
  }

  .header-info h2 {
    font-size: var(--fs-xl);
    font-weight: var(--fw-bold);
    color: var(--color-text);
  }

  .count-tip {
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
  }

  .clear-btn {
    display: inline-flex;
    align-items: center;
    padding: var(--spacing-sm) var(--spacing-base);
    background-color: var(--color-danger-light);
    color: var(--color-danger);
    border: 1px solid rgba(255, 77, 79, 0.2);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
    transition: all var(--transition-fast);
  }

  .clear-btn:hover {
    background-color: var(--color-danger);
    color: #ffffff;
    border-color: var(--color-danger);
  }

  .trash-timeline {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-base);
    max-width: 640px;
    width: 100%;
    margin: 0 auto;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl) var(--spacing-lg);
    text-align: center;
  }

  .empty-icon {
    font-size: var(--fs-2xl);
    margin-bottom: var(--spacing-md);
  }

  .empty-state h3 {
    font-size: var(--fs-md);
    color: var(--color-text);
    margin-bottom: var(--spacing-xs);
  }

  .empty-state p {
    font-size: var(--fs-sm);
    color: var(--color-text-secondary);
  }

  .trash-memo-card {
    padding: var(--spacing-base);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .memo-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: var(--spacing-sm);
  }

  .memo-time {
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
  }

  .memo-actions {
    display: flex;
    gap: var(--spacing-sm);
  }

  .action-btn {
    border: none;
    background: none;
    cursor: pointer;
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
    display: inline-flex;
    align-items: center;
    padding: 4px var(--spacing-sm);
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }

  .action-btn.restore {
    color: var(--color-primary);
    background-color: var(--color-primary-light);
  }

  .action-btn.restore:hover {
    background-color: var(--color-primary);
    color: #ffffff;
  }

  .action-btn.delete {
    color: var(--color-text-secondary);
    background-color: var(--color-bg);
  }

  .action-btn.delete:hover {
    color: var(--color-danger);
    background-color: var(--color-danger-light);
  }

  .memo-body {
    padding: var(--spacing-xs) 0;
  }

  .memo-text {
    font-size: var(--fs-base);
    color: var(--color-text);
    line-height: var(--lh-base);
    white-space: pre-wrap;
    word-break: break-all;
  }

  .memo-resources {
    margin-top: var(--spacing-sm);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .resource-img {
    max-width: 100%;
    max-height: 240px;
    border-radius: var(--radius-sm);
    object-fit: cover;
  }

  .resource-audio {
    width: 100%;
  }

  .resource-file {
    font-size: var(--fs-xs);
    color: var(--color-info);
    text-decoration: none;
  }

  .resource-file:hover {
    text-decoration: underline;
  }

  .memo-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--spacing-xs);
  }

  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }

  .tag-badge {
    font-size: var(--fs-xs);
    color: var(--color-primary);
    background-color: var(--color-primary-light);
    padding: 2px var(--spacing-sm);
    border-radius: var(--radius-round);
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

    .content-header {
      gap: var(--spacing-sm);
      flex-wrap: wrap;
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

    .trash-timeline {
      max-width: 100%;
    }
  }
</style>
