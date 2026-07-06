<!-- MemoList.svelte - MemoFlow 笔记时间流列表组件，基于 Svelte 5 Runes -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { filteredMemos, memos, memoFilter } from '$lib/stores/memos';
  import MemoCard from './MemoCard.svelte';

  // 内部状态：当前前端已加载渲染的笔记条数
  let visibleCount = $state(15);
  // 底部哨兵 Sentinel DOM 引用
  let observerTarget = $state<HTMLElement | null>(null);

  // 派生属性：根据 visibleCount 截取待渲染的笔记列表
  const displayedMemos = $derived($filteredMemos.slice(0, visibleCount));

  // 重置过滤条件
  function handleClearFilter() {
    memoFilter.set({
      tag: null,
      search: null,
      onlyPinned: false,
      onlyArchived: false,
      dateRange: null,
      specialFilter: null
    });
  }

  // 触发刷新/重新加载数据
  async function handleRefresh() {
    try {
      await memos.fetchMemos();
    } catch (err) {
      console.error('刷新笔记失败:', err);
    }
  }

  // 使用 Intersection Observer 进行无限滚动性能优化（前端截断分页）
  onMount(() => {
    if (!observerTarget) return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      // 当哨兵元素进入视口时，如果当前展示的笔记数小于过滤出来的总数，则增量展示
      if (entry.isIntersecting) {
        if (visibleCount < $filteredMemos.length) {
          visibleCount = Math.min(visibleCount + 15, $filteredMemos.length);
        }
      }
    }, {
      rootMargin: '120px' // 提前 120px 载入，提升用户体验
    });

    observer.observe(observerTarget);

    return () => {
      observer.disconnect();
    };
  });

  // Svelte 5 副作用：当过滤结果的长度发生变化时，重置已展示数量为默认的 15 条
  $effect(() => {
    // 跟踪 filteredMemos 的变更
    const len = $filteredMemos.length;
    visibleCount = 15;
  });
</script>

<div class="memo-list-container">
  
  <!-- 顶部统计与刷新功能区 -->
  <div class="refresh-bar flex justify-between align-center card">
    <div class="count-text flex align-center gap-xs">
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
      <span>共计 <strong>{$filteredMemos.length}</strong> 条笔记</span>
    </div>
    
    <button 
      class="btn btn-secondary refresh-btn" 
      onclick={handleRefresh} 
      disabled={$memos.loading}
    >
      {#if $memos.loading}
        <span class="spinner inline-spinner"></span>
        <span>载入中...</span>
      {:else}
        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        <span>加载最新</span>
      {/if}
    </button>
  </div>

  <!-- 笔记流列表 -->
  <div class="memo-list">
    {#each displayedMemos as memo (memo.id)}
      <MemoCard {memo} />
    {:else}
      <!-- 当无数据且未在加载中时，显示空状态 -->
      {#if !$memos.loading}
        <div class="empty-state card flex flex-col align-center justify-center">
          <div class="empty-icon-wrapper">
            <svg viewBox="0 0 24 24" width="56" height="56" stroke="var(--color-text-placeholder)" stroke-width="1.5" fill="none">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <circle cx="12" cy="14" r="3"></circle>
              <line x1="12" y1="11" x2="12" y2="11.01"></line>
            </svg>
          </div>
          <p class="empty-title">暂无笔记</p>
          {#if $memoFilter.tag || $memoFilter.search || $memoFilter.specialFilter}
            <p class="empty-desc">当前筛选条件下未检索到匹配的笔记</p>
            <button class="btn btn-primary clear-btn" onclick={handleClearFilter}>
              清除所有过滤
            </button>
          {:else}
            <p class="empty-desc">点击上方的输入框，开始记录你的第一条碎碎念吧！</p>
          {/if}
        </div>
      {/if}
    {/each}
  </div>

  <!-- 无限滚动底部哨兵 -->
  {#if $filteredMemos.length > visibleCount}
    <div bind:this={observerTarget} class="sentinel flex justify-center align-center">
      <span class="spinner text-spinner"></span>
      <span class="sentinel-text">加载更多中...</span>
    </div>
  {/if}
</div>

<style>
  .memo-list-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-base);
    width: 100%;
  }

  /* 顶部刷新控制栏 */
  .refresh-bar {
    padding: var(--spacing-sm) var(--spacing-base);
    height: 42px;
  }
  .count-text {
    font-size: var(--fs-sm);
    color: var(--color-text-secondary);
  }
  .count-text strong {
    color: var(--color-primary);
    margin: 0 2px;
  }
  .refresh-btn {
    height: 28px;
    padding: 0 var(--spacing-sm);
    font-size: var(--fs-xs);
    gap: var(--spacing-xs);
  }

  /* 旋转 Loading */
  .spinner {
    display: inline-block;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  .inline-spinner {
    width: 12px;
    height: 12px;
    border-width: 1.5px;
  }
  .text-spinner {
    width: 14px;
    height: 14px;
    border-width: 2px;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* 笔记流列表 */
  .memo-list {
    display: flex;
    flex-direction: column;
  }

  /* 空白占位状态 */
  .empty-state {
    padding: var(--spacing-2xl) var(--spacing-base);
    text-align: center;
    border-radius: var(--radius-lg);
    background-color: var(--color-card);
    border: 1px solid var(--color-border);
  }
  .empty-icon-wrapper {
    color: var(--color-text-placeholder);
    opacity: 0.8;
  }
  .empty-title {
    font-size: var(--fs-md);
    font-weight: var(--fw-semibold);
    color: var(--color-text);
    margin-top: var(--spacing-sm);
  }
  .empty-desc {
    font-size: var(--fs-sm);
    color: var(--color-text-secondary);
    margin-top: var(--spacing-xs);
    margin-bottom: var(--spacing-md);
    max-width: 280px;
  }
  .clear-btn {
    padding: var(--spacing-sm) var(--spacing-base);
    font-size: var(--fs-sm);
    height: 34px;
  }

  /* 底部哨兵 */
  .sentinel {
    padding: var(--spacing-base);
    gap: var(--spacing-sm);
  }
  .sentinel-text {
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
  }
</style>
