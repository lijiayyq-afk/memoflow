<script lang="ts">
  /* src/lib/components/SearchModal.svelte - 全局搜索弹窗组件，基于 Svelte 5 Runes */
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { ui } from '$lib/stores/ui';
  import { filteredMemos, memoFilter } from '$lib/stores/memos';

  // 局部状态变量
  let query = $state(''); // 搜索词
  let inputEl = $state<HTMLInputElement | null>(null); // 搜索输入框 DOM 引用

  // 处理关闭弹窗，重置搜索词
  function handleClose() {
    ui.setSearch(false);
  }

  // 监听全局按键，实现 Ctrl/Cmd + K 打开和 Esc 关闭
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      ui.setSearch(true);
    } else if (e.key === 'Escape' && $ui.searchActive) {
      e.preventDefault();
      handleClose();
    }
  }

  // 选中某条笔记，呼起编辑弹窗并关闭搜索
  function handleSelectMemo(memo: any) {
    handleClose();
    ui.setActiveMemoId(memo.id);
    ui.setMemoDraft(memo.content);
    ui.setEditModalOpen(true);
  }

  // 纯文本过滤辅助：剥离 HTML 标签以展示纯文本摘要
  function stripHtml(html: string): string {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body.textContent || '';
    } catch (e) {
      // 降级使用正则过滤
      return html.replace(/<[^>]*>/g, '');
    }
  }

  // Svelte 5 副作用：当 query 发生变化时，实时联动更新 memoFilter store
  $effect(() => {
    // 跟踪 query 变量，去空格
    const keyword = query.trim();
    memoFilter.update(f => ({ 
      ...f, 
      search: keyword || null 
    }));
  });

  // Svelte 5 副作用：当弹窗激活时，清空上次的输入，并自动聚焦输入框
  $effect(() => {
    if ($ui.searchActive) {
      query = ''; // 清空搜索词
      // 延迟聚焦，确保 DOM 已渲染
      setTimeout(() => {
        if (inputEl) inputEl.focus();
      }, 60);
    }
  });

  // 组件挂载时注册键盘事件，销毁时自动移除
  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });
</script>

{#if $ui.searchActive}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div 
    class="search-overlay" 
    onclick={handleClose} 
    transition:fade={{ duration: 150 }}
  >
    <!-- 阻止冒泡，避免点击弹窗内部导致关闭 -->
    <div class="search-dialog card" onclick={(e) => e.stopPropagation()}>
      
      <!-- 搜索头部输入区 -->
      <div class="search-header flex align-center">
        <svg class="search-icon" viewBox="0 0 24 24" width="18" height="18" stroke="var(--color-text-placeholder)" stroke-width="2.2" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input 
          bind:this={inputEl}
          bind:value={query}
          type="text" 
          placeholder="输入内容或标签进行搜索..." 
          class="search-input"
          onkeydown={(e) => {
            if (e.key === 'Escape') handleClose();
          }}
        />
        <button class="close-btn" onclick={handleClose} title="点击退出">Esc</button>
      </div>

      <!-- 搜索结果列表区 -->
      <div class="search-results">
        {#each $filteredMemos as memo (memo.id)}
          <button class="result-item" onclick={() => handleSelectMemo(memo)}>
            <div class="result-meta flex justify-between align-center">
              <span class="result-date">{new Date(memo.createdAt).toLocaleDateString()}</span>
              {#if memo.isPinned}
                <span class="pin-badge flex align-center gap-xs">
                  <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2.5" fill="currentColor"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  置顶
                </span>
              {/if}
            </div>
            <div class="result-text">{stripHtml(memo.content)}</div>
          </button>
        {:else}
          <div class="no-results flex flex-col align-center justify-center">
            {#if query.trim() !== ''}
              <p class="no-results-title">未找到匹配的笔记</p>
              <p class="no-results-desc">换个关键词试试吧</p>
            {:else}
              <svg viewBox="0 0 24 24" width="36" height="36" stroke="var(--color-text-placeholder)" stroke-width="1.5" fill="none" class="no-results-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <p class="no-results-title">输入关键词检索笔记</p>
              <p class="no-results-desc">匹配范围包含笔记正文和所有标签</p>
            {/if}
          </div>
        {/each}
      </div>

      <!-- 底部状态说明栏 -->
      <div class="search-footer flex justify-between align-center">
        <span class="shortcut-tip">Esc 关闭搜索</span>
        <span class="shortcut-tip">点击笔记可快速进行编辑</span>
      </div>
    </div>
  </div>
{/if}

<style>
  /* 黑色透明半遮罩 */
  .search-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.4);
    z-index: 999;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 12vh;
  }

  /* 搜索对话框样式 */
  .search-dialog {
    width: 100%;
    max-width: 560px;
    background-color: var(--color-card);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: 60vh;
    animation: slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes slideUp {
    from { transform: scale(0.97) translateY(-12px); opacity: 0; }
    to { transform: scale(1) translateY(0); opacity: 1; }
  }

  /* 搜索头部 */
  .search-header {
    padding: var(--spacing-base);
    border-bottom: 1px solid var(--color-border);
    gap: var(--spacing-md);
    background-color: var(--color-card);
  }
  .search-icon {
    flex-shrink: 0;
    color: var(--color-text-placeholder);
  }
  .search-input {
    flex: 1;
    border: none;
    outline: none;
    font-size: var(--fs-md);
    color: var(--color-text);
    background: transparent;
  }
  .search-input::placeholder {
    color: var(--color-text-placeholder);
  }

  /* 关闭按钮提示 */
  .close-btn {
    background-color: var(--color-bg);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    font-size: var(--fs-xs);
    padding: 2px var(--spacing-sm);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-mono);
    transition: all var(--transition-fast);
  }
  .close-btn:hover {
    border-color: var(--color-border-hover);
    color: var(--color-text);
  }

  /* 搜索结果渲染列表 */
  .search-results {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-sm);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    background-color: var(--color-card);
  }
  
  .result-item {
    background: none;
    border: none;
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
    text-align: left;
    cursor: pointer;
    transition: background-color var(--transition-fast);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    width: 100%;
  }
  .result-item:hover {
    background-color: var(--color-bg);
  }

  .result-meta {
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
  }
  
  .pin-badge {
    background-color: var(--color-primary-light);
    color: var(--color-primary);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    font-weight: var(--fw-medium);
  }
  .gap-xs {
    gap: 4px;
  }

  .result-text {
    font-size: var(--fs-sm);
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: var(--lh-base);
  }

  /* 无结果样式 */
  .no-results {
    padding: var(--spacing-2xl) var(--spacing-base);
    color: var(--color-text-secondary);
    text-align: center;
  }
  .no-results-icon {
    color: var(--color-text-placeholder);
    margin-bottom: var(--spacing-sm);
  }
  .no-results-title {
    font-size: var(--fs-base);
    color: var(--color-text);
    font-weight: var(--fw-semibold);
  }
  .no-results-desc {
    font-size: var(--fs-sm);
    color: var(--color-text-secondary);
    margin-top: 4px;
  }

  /* 搜索尾部 */
  .search-footer {
    padding: var(--spacing-sm) var(--spacing-base);
    background-color: var(--color-bg);
    border-top: 1px solid var(--color-border);
  }
  .shortcut-tip {
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
  }
</style>
