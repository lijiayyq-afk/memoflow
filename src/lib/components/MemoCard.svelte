<script lang="ts">
  /* src/lib/components/MemoCard.svelte - 笔记卡片组件，基于 Svelte 5 Runes */
  import { fade } from 'svelte/transition';
  import type { Memo } from '$lib/types';
  import { memos, memoFilter } from '$lib/stores/memos';
  import { ui } from '$lib/stores/ui';

  // Svelte 5 属性声明：接收单条笔记和双击编辑回调
  let { 
    memo, 
    onedit 
  }: { 
    memo: Memo; 
    onedit?: (memo: Memo) => void 
  } = $props();

  // 局部状态变量
  let menuOpen = $state(false); // 控制下拉菜单的展开/关闭
  let activePreviewUrl = $state<string | null>(null); // 灯箱大图预览地址
  let contentEl = $state<HTMLElement | null>(null); // 笔记正文 DOM 引用

  // 计算属性：过滤出所有的图片资源
  const images = $derived((memo.resources || []).filter(res => res.mimeType.startsWith('image/')));

  // 格式化 ISO 时间为 "YYYY-MM-DD HH:mm:ss"
  function formatTimestamp(isoString: string): string {
    try {
      const date = new Date(isoString);
      const Y = date.getFullYear();
      const M = String(date.getMonth() + 1).padStart(2, '0');
      const D = String(date.getDate()).padStart(2, '0');
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      const s = String(date.getSeconds()).padStart(2, '0');
      return `${Y}-${M}-${D} ${h}:${m}:${s}`;
    } catch (e) {
      return isoString;
    }
  }

  // 双击事件：进入编辑状态
  function handleDblClick() {
    if (onedit) {
      onedit(memo);
    }
    // 联动全局 UI 状态
    ui.setActiveMemoId(memo.id);
    ui.setMemoDraft(memo.content);
    ui.setEditModalOpen(true);
  }

  // 操作菜单切换
  function toggleMenu(e: Event) {
    e.stopPropagation();
    menuOpen = !menuOpen;
  }

  function closeMenu() {
    menuOpen = false;
  }

  // 编辑操作
  function handleEditClick(e: Event) {
    e.stopPropagation();
    closeMenu();
    handleDblClick();
  }

  // 置顶/取消置顶操作
  function handleTogglePin(e: Event) {
    e.stopPropagation();
    closeMenu();
    memos.togglePin(memo.id);
  }

  // 移至回收站（软删除）操作
  async function handleDelete(e: Event) {
    e.stopPropagation();
    closeMenu();
    await memos.deleteMemo(memo.id);
  }

  // 全局点击自动收起下拉菜单
  function handleWindowClick() {
    if (menuOpen) closeMenu();
  }

  // 标签点击联动搜索过滤
  function handleTagClick(e: Event, tag: string) {
    e.stopPropagation();
    // 自动激活对该标签的筛选，联动 memos.ts store
    memoFilter.update(f => ({ ...f, tag }));
  }

  // 打开大图预览
  function openPreview(e: Event, url: string) {
    e.stopPropagation();
    activePreviewUrl = url;
  }

  // 关闭大图预览
  function closePreview() {
    activePreviewUrl = null;
  }

  // Svelte 5 副作用：优化 HTML 内的链接节点
  $effect(() => {
    if (contentEl) {
      // 找到所有的 <a> 标签
      const links = contentEl.querySelectorAll('a');
      links.forEach(link => {
        // 设置在新窗口打开，且添加安全属性
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        // 点击链接时，阻止卡片自身的点击或双击事件触发
        link.addEventListener('click', (e) => e.stopPropagation());
      });
    }
  });
</script>

<svelte:window onclick={handleWindowClick} />

<!-- 笔记卡片容器，支持双击编辑，若被置顶添加特殊边框 -->
<div class="memo-card card" class:is-pinned={memo.isPinned}>
  
  <!-- 顶部状态信息与下拉操作菜单 -->
  <div class="memo-header flex justify-between align-center">
    <div class="header-left flex align-center gap-xs">
      {#if memo.isPinned}
        <span class="pinned-badge" title="置顶">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="currentColor"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        </span>
      {/if}
      <span class="memo-time">{formatTimestamp(memo.createdAt)}</span>
    </div>

    <!-- 菜单控制区 -->
    <div class="memo-actions-container">
      <button class="btn-icon" onclick={toggleMenu} aria-label="操作菜单">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
      </button>
      {#if menuOpen}
        <div class="action-dropdown card">
          <button class="dropdown-item" onclick={handleEditClick}>
            <svg class="icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"></path></svg>
            编辑
          </button>
          <button class="dropdown-item" onclick={handleTogglePin}>
            <svg class="icon" class:pinned={memo.isPinned} viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            {memo.isPinned ? '取消置顶' : '置顶'}
          </button>
          <button class="dropdown-item danger" onclick={handleDelete}>
            <svg class="icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            移至回收站
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- 笔记主体（可双击编辑） -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div 
    class="memo-card-body" 
    ondblclick={handleDblClick} 
    role="article"
    title="双击进行编辑"
  >
    <!-- 富文本 HTML 内容 -->
    <div class="memo-content" bind:this={contentEl}>
      {@html memo.content}
    </div>

    <!-- 标签列表 -->
    {#if memo.tags && memo.tags.length > 0}
      <div class="memo-tags flex flex-wrap gap-xs">
        {#each memo.tags as tag}
          <button class="tag-badge" onclick={(e) => handleTagClick(e, tag)}>
            #{tag}
          </button>
        {/each}
      </div>
    {/if}

    <!-- 图片缩略图网格 -->
    {#if images.length > 0}
      <div 
        class="memo-images-grid" 
        class:grid-cols-1={images.length === 1} 
        class:grid-cols-2={images.length === 2} 
        class:grid-cols-3={images.length >= 3}
      >
        {#each images as img}
          <button class="image-thumbnail-btn" onclick={(e) => openPreview(e, img.url)}>
            <img src={img.url} alt={img.filename} loading="lazy" class="image-thumbnail" />
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- 图片灯箱 (Lightbox) 全屏大图预览 -->
{#if activePreviewUrl}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div 
    class="lightbox-overlay" 
    onclick={closePreview} 
    transition:fade={{ duration: 150 }}
  >
    <button class="lightbox-close-btn" onclick={closePreview} aria-label="关闭预览">
      <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
    <img 
      src={activePreviewUrl} 
      alt="大图预览" 
      class="lightbox-img" 
      onclick={(e) => e.stopPropagation()} 
    />
  </div>
{/if}

<style>
  /* 基础卡片样式，符合 flomo/MemoFlow 视觉规范 */
  .memo-card {
    padding: var(--spacing-base);
    background-color: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    margin-bottom: var(--spacing-base);
    transition: border-color var(--transition-base), box-shadow var(--transition-base);
    cursor: default;
    position: relative;
  }
  .memo-card:hover {
    border-color: var(--color-border-hover);
    box-shadow: var(--shadow-md);
  }
  /* 置顶卡片的边框加深，并提供微小的左侧绿条 */
  .memo-card.is-pinned {
    border-left: 3px solid var(--color-primary);
  }

  /* 顶部时间戳和下拉菜单 */
  .memo-header {
    margin-bottom: var(--spacing-sm);
    padding-bottom: var(--spacing-xs);
    border-bottom: 1px solid rgba(0, 0, 0, 0.03);
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }
  .pinned-badge {
    color: var(--color-primary);
    display: inline-flex;
    align-items: center;
  }
  .memo-time {
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
  }

  /* 下拉菜单控制 */
  .memo-actions-container {
    position: relative;
  }
  .btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-secondary);
    padding: var(--spacing-xs);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color var(--transition-fast), color var(--transition-fast);
  }
  .btn-icon:hover {
    background-color: rgba(0, 0, 0, 0.05);
    color: var(--color-text);
  }

  .action-dropdown {
    position: absolute;
    right: 0;
    top: 100%;
    z-index: 10;
    min-width: 120px;
    background-color: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    padding: var(--spacing-xs) 0;
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    animation: dropdownFade var(--transition-fast) ease-out;
  }
  @keyframes dropdownFade {
    from { opacity: 0; transform: scale(0.95) translateY(-5px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  .dropdown-item {
    background: none;
    border: none;
    width: 100%;
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
  .dropdown-item .icon {
    flex-shrink: 0;
  }
  .dropdown-item .icon.pinned {
    fill: var(--color-primary);
    stroke: var(--color-primary);
  }

  /* 笔记内容区域 */
  .memo-card-body {
    user-select: text;
  }
  .memo-content {
    font-size: var(--fs-base);
    line-height: var(--lh-loose);
    color: var(--color-text);
    word-break: break-all;
  }
  
  /* 全局富文本渲染微调，确保高亮和超链接适配 */
  :global(.memo-content mark) {
    background-color: var(--color-primary-light);
    color: var(--color-primary-hover);
    padding: 0 4px;
    border-radius: var(--radius-sm);
    font-weight: var(--fw-medium);
  }
  :global(.memo-content a) {
    color: var(--color-primary);
    text-decoration: underline;
    text-underline-offset: 3px;
    transition: color var(--transition-fast);
  }
  :global(.memo-content a:hover) {
    color: var(--color-primary-hover);
  }
  :global(.memo-content p) {
    margin-bottom: var(--spacing-sm);
  }
  :global(.memo-content p:last-child) {
    margin-bottom: 0;
  }

  /* 标签 */
  .gap-xs {
    gap: var(--spacing-xs);
  }
  .memo-tags {
    margin-top: var(--spacing-md);
  }
  .tag-badge {
    background-color: var(--color-primary-light);
    color: var(--color-primary);
    font-size: var(--fs-xs);
    padding: 2px 8px;
    border-radius: var(--radius-round);
    border: none;
    cursor: pointer;
    font-weight: var(--fw-medium);
    transition: background-color var(--transition-fast), color var(--transition-fast);
  }
  .tag-badge:hover {
    background-color: var(--color-primary);
    color: #FFFFFF;
  }

  /* 图片展示网格 */
  .memo-images-grid {
    display: grid;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-md);
  }
  .grid-cols-1 { grid-template-columns: 1fr; }
  .grid-cols-2 { grid-template-columns: 1fr 1fr; }
  .grid-cols-3 { grid-template-columns: 1fr 1fr 1fr; }

  .image-thumbnail-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: zoom-in;
    border-radius: var(--radius-md);
    overflow: hidden;
    display: block;
    aspect-ratio: 1 / 1;
    border: 1px solid var(--color-border);
  }
  .image-thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform var(--transition-base);
  }
  .image-thumbnail-btn:hover .image-thumbnail {
    transform: scale(1.04);
  }

  /* Lightbox 灯箱大图 */
  .lightbox-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.75);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-lg);
  }
  .lightbox-img {
    max-width: 90%;
    max-height: 90%;
    object-fit: contain;
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-lg);
    animation: lightboxZoom 0.25s cubic-bezier(0.1, 0.8, 0.25, 1);
  }
  @keyframes lightboxZoom {
    from { transform: scale(0.92); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  .lightbox-close-btn {
    position: absolute;
    top: var(--spacing-lg);
    right: var(--spacing-lg);
    background: rgba(255, 255, 255, 0.15);
    border: none;
    color: #FFFFFF;
    padding: var(--spacing-sm);
    border-radius: var(--radius-round);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color var(--transition-fast);
  }
  .lightbox-close-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }
</style>
