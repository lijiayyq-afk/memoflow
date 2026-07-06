# MemoFlow 笔记列表与展示组件开发计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 MemoFlow 应用中的单条笔记卡片展示组件 (`MemoCard.svelte`)、滚动分页时间流列表组件 (`MemoList.svelte`) 和全局快捷搜索弹窗组件 (`SearchModal.svelte`)。

**Architecture:** 组件遵循 Svelte 5 Runes 规范开发，通过 callback 属性向父组件传递事件（例如双击触发编辑）。状态过滤和数据流完全与 `src/lib/stores/memos.ts` 以及 `src/lib/stores/ui.ts` 联动。无限滚动通过在列表底部使用 Sentinel DOM 结合 `Intersection Observer` 实现前端分页渲染，控制一次渲染的 DOM 数量。

**Tech Stack:** SvelteKit 2.x, Svelte 5 (Runes), TypeScript, Vanilla CSS.

---

## 预定义文件接口

### 1. `src/lib/components/MemoCard.svelte` Props 接口
```typescript
interface Props {
  memo: Memo;
  onedit?: (memo: Memo) => void;
}
```

---

## 任务分解清单

### Task 1: 编写 `MemoCard.svelte` 基础结构与时间展示、双击事件

**Files:**
- Create: `src/lib/components/MemoCard.svelte`

- [ ] **Step 1: 创建 `src/lib/components/MemoCard.svelte` 编写基础 HTML 结构与双击编辑事件**

```html
<script lang="ts">
  import type { Memo } from '$lib/types';
  import { ui } from '$lib/stores/ui';
  
  // Svelte 5 属性接收
  let { memo, onedit }: { memo: Memo; onedit?: (memo: Memo) => void } = $props();

  // 时间格式化辅助函数
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

  // 双击事件处理器
  function handleDblClick() {
    if (onedit) {
      onedit(memo);
    }
    ui.setActiveMemoId(memo.id);
    ui.setMemoDraft(memo.content);
    ui.setEditModalOpen(true);
  }
</script>

<div class="memo-card card" ondblclick={handleDblClick}>
  <div class="memo-header flex justify-between align-center">
    <span class="memo-time">{formatTimestamp(memo.createdAt)}</span>
    <!-- 后续 Task 填充操作下拉菜单 -->
    <div class="memo-actions-placeholder">...</div>
  </div>
  <div class="memo-content-wrapper">
    <!-- 后续 Task 填充 tiptap HTML 正文 -->
    <div class="memo-raw-text">{memo.content}</div>
  </div>
</div>

<style>
  .memo-card {
    padding: var(--spacing-base);
    background-color: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    margin-bottom: var(--spacing-base);
    transition: all var(--transition-base);
    cursor: default;
    user-select: text;
  }
  .memo-card:hover {
    border-color: var(--color-border-hover);
    box-shadow: var(--shadow-md);
  }
  .memo-header {
    margin-bottom: var(--spacing-sm);
    border-bottom: 1px solid rgba(0,0,0,0.02);
    padding-bottom: var(--spacing-xs);
  }
  .memo-time {
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
  }
  .memo-content-wrapper {
    font-size: var(--fs-base);
    line-height: var(--lh-loose);
    color: var(--color-text);
    word-break: break-all;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/MemoCard.svelte
git commit -m "feat: init MemoCard with basic layout and double click editor trigger"
```

---

### Task 2: 实现 `MemoCard.svelte` 的操作下拉菜单（编辑、置顶、删除）与联动

**Files:**
- Modify: `src/lib/components/MemoCard.svelte`

- [ ] **Step 1: 在 `MemoCard.svelte` 中引入 memos store，并添加下拉菜单逻辑与样式**

```html
<!-- 在 <script> 中加入: -->
import { memos } from '$lib/stores/memos';

let menuOpen = $state(false);

function toggleMenu(e: Event) {
  e.stopPropagation();
  menuOpen = !menuOpen;
}

function closeMenu() {
  menuOpen = false;
}

function handleEdit(e: Event) {
  e.stopPropagation();
  closeMenu();
  handleDblClick();
}

function handleTogglePin(e: Event) {
  e.stopPropagation();
  closeMenu();
  memos.togglePin(memo.id);
}

async function handleDelete(e: Event) {
  e.stopPropagation();
  closeMenu();
  await memos.deleteMemo(memo.id);
}

// 监听全局点击以自动关闭菜单
function handleWindowClick() {
  if (menuOpen) closeMenu();
}
```

在 HTML 结构中，替换 `<div class="memo-actions-placeholder">...</div>`：

```html
<svelte:window onclick={handleWindowClick} />

<div class="memo-actions-container">
  <button class="btn-icon" onclick={toggleMenu} aria-label="更多操作">
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
  </button>
  {#if menuOpen}
    <div class="action-dropdown card">
      <button class="dropdown-item" onclick={handleEdit}>
        <svg class="icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"></path></svg>
        编辑
      </button>
      <button class="dropdown-item" onclick={handleTogglePin}>
        <svg class="icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" class:pinned={memo.isPinned}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        {memo.isPinned ? '取消置顶' : '置顶'}
      </button>
      <button class="dropdown-item danger" onclick={handleDelete}>
        <svg class="icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        移至回收站
      </button>
    </div>
  {/if}
</div>
```

在 `<style>` 中加入：

```css
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
    transition: all var(--transition-fast);
  }
  .btn-icon:hover {
    background-color: rgba(0,0,0,0.05);
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/MemoCard.svelte
git commit -m "feat: add drop down action menu in MemoCard for editing, pinning, and deleting"
```

---

### Task 3: 实现 `MemoCard.svelte` 的 Tiptap HTML 解析与富文本样式处理（高亮与外链）

**Files:**
- Modify: `src/lib/components/MemoCard.svelte`

- [ ] **Step 1: 支持正文渲染及超链接优化**

修改 `MemoCard.svelte` 正文部分，将 `<div class="memo-raw-text">{memo.content}</div>` 更改为标准 HTML 渲染：

```html
<div class="memo-content" bind:this={contentEl}>
  {@html memo.content}
</div>
```

在 `<script>` 中加入：

```typescript
  import { onMount } from 'svelte';

  let contentEl = $state<HTMLElement | null>(null);

  // 用副作用为富文本中产生的所有超链接加上 target="_blank"
  $effect(() => {
    if (contentEl) {
      const links = contentEl.querySelectorAll('a');
      links.forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        // 添加点击事件阻止冒泡，避免触发双击/卡片全局点击
        link.addEventListener('click', (e) => e.stopPropagation());
      });
    }
  });
```

在 `<style>` 中加入：

```css
  .memo-content {
    font-size: var(--fs-base);
    line-height: var(--lh-loose);
    color: var(--color-text);
  }
  
  /* 支持 Tiptap 的高亮样式 mark */
  :global(.memo-content mark) {
    background-color: var(--color-primary-light);
    color: var(--color-primary-hover);
    padding: 2px 4px;
    border-radius: var(--radius-sm);
    font-weight: var(--fw-medium);
  }

  /* 样式化正文中的 a 标签 */
  :global(.memo-content a) {
    color: var(--color-primary);
    text-decoration: underline;
    text-underline-offset: 3px;
    transition: color var(--transition-fast);
  }

  :global(.memo-content a:hover) {
    color: var(--color-primary-hover);
  }

  /* 适配其他常见 HTML 节点样式 */
  :global(.memo-content p) {
    margin-bottom: var(--spacing-sm);
  }
  :global(.memo-content p:last-child) {
    margin-bottom: 0;
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/MemoCard.svelte
git commit -m "feat: parse Tiptap HTML content with style formatting for links and mark tags"
```

---

### Task 4: 实现 `MemoCard.svelte` 的多级标签点击筛选与图片资源 Lightbox 预览

**Files:**
- Modify: `src/lib/components/MemoCard.svelte`

- [ ] **Step 1: 加入标签联动和图片灯箱预览代码**

在 `<script>` 中加入：

```typescript
  import { memoFilter } from '$lib/stores/memos';

  // 处理标签点击
  function handleTagClick(e: Event, clickedTag: string) {
    e.stopPropagation();
    memoFilter.update(f => ({ ...f, tag: clickedTag }));
  }

  // 计算图片资源
  const images = $derived((memo.resources || []).filter(res => res.mimeType.startsWith('image/')));

  // 灯箱大图预览状态
  let activePreviewUrl = $state<string | null>(null);

  function openPreview(e: Event, url: string) {
    e.stopPropagation();
    activePreviewUrl = url;
  }

  function closePreview() {
    activePreviewUrl = null;
  }
```

在 HTML 结构中，在 `.memo-content` 节点后添加标签与资源展示：

```html
  <!-- 标签展示 -->
  {#if memo.tags && memo.tags.length > 0}
    <div class="memo-tags flex flex-wrap gap-xs">
      {#each memo.tags as tag}
        <button class="tag-badge" onclick={(e) => handleTagClick(e, tag)}>
          #{tag}
        </button>
      {/each}
    </div>
  {/if}

  <!-- 图片展示网格 -->
  {#if images.length > 0}
    <div class="memo-images-grid" class:grid-cols-1={images.length === 1} class:grid-cols-2={images.length === 2} class:grid-cols-3={images.length >= 3}>
      {#each images as img}
        <button class="image-thumbnail-btn" onclick={(e) => openPreview(e, img.url)}>
          <img src={img.url} alt={img.filename} loading="lazy" class="image-thumbnail" />
        </button>
      {/each}
    </div>
  {/if}

  <!-- 灯箱 Lightbox 模态遮罩层 -->
  {#if activePreviewUrl}
    <div class="lightbox-overlay" onclick={closePreview} transition:fade={{ duration: 150 }}>
      <button class="lightbox-close-btn" onclick={closePreview} aria-label="关闭预览">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
      <img src={activePreviewUrl} alt="预览图片" class="lightbox-img" onclick={(e) => e.stopPropagation()} />
    </div>
  {/if}
```

在 `<script>` 顶部引入 `fade` 动画组件：
```typescript
  import { fade } from 'svelte/transition';
```

在 `<style>` 中加入：

```css
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
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-round);
    border: none;
    cursor: pointer;
    font-weight: var(--fw-medium);
    transition: all var(--transition-fast);
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
    animation: lightboxZoom var(--transition-base) cubic-bezier(0.1, 0.8, 0.25, 1);
  }
  @keyframes lightboxZoom {
    from { transform: scale(0.9); }
    to { transform: scale(1); }
  }
  .lightbox-close-btn {
    position: absolute;
    top: var(--spacing-lg);
    right: var(--spacing-lg);
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: #FFFFFF;
    padding: var(--spacing-sm);
    border-radius: var(--radius-round);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background var(--transition-fast);
  }
  .lightbox-close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/MemoCard.svelte
git commit -m "feat: implement tags filtering and R2 image layout with Lightbox zoom modal"
```

---

### Task 5: 创建 `src/lib/components/MemoList.svelte` 结构与 infinite scroll (Intersection Observer) 前端分页加载

**Files:**
- Create: `src/lib/components/MemoList.svelte`

- [ ] **Step 1: 编写 `MemoList.svelte` 的基础结构、哨兵逻辑和分页切片逻辑**

```html
<script lang="ts">
  import { onMount } from 'svelte';
  import { filteredMemos, memos } from '$lib/stores/memos';
  import MemoCard from './MemoCard.svelte';

  // 内部控制前端只渲染 visibleCount 条
  let visibleCount = $state(15);
  let observerTarget = $state<HTMLElement | null>(null);

  // 派生计算切片数据
  const displayedMemos = $derived($filteredMemos.slice(0, visibleCount));

  // 用 IntersectionObserver 观测页面底部
  onMount(() => {
    if (!observerTarget) return;

    const observer = new IntersectionObserver((entries) => {
      const target = entries[0];
      if (target.isIntersecting) {
        // 还有多余笔记时，增量加载
        if (visibleCount < $filteredMemos.length) {
          visibleCount += 15;
        }
      }
    }, {
      rootMargin: '100px'
    });

    observer.observe(observerTarget);

    return () => {
      observer.disconnect();
    };
  });

  // 当过滤条件改变导致笔记总量变化时，重置分页为 15
  $effect(() => {
    const totalCount = $filteredMemos.length;
    visibleCount = 15;
  });
</script>

<div class="memo-list-container">
  <!-- 顶部提示在 Task 6 丰富 -->
  <div class="memo-list">
    {#each displayedMemos as memo (memo.id)}
      <MemoCard {memo} />
    {/each}
  </div>

  <!-- 滚动哨兵 Sentinel -->
  <div bind:this={observerTarget} class="sentinel">
    {#if visibleCount < $filteredMemos.length}
      <div class="loading-more">
        <span class="spinner"></span>
        加载中...
      </div>
    {/if}
  </div>
</div>

<style>
  .memo-list-container {
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    padding: var(--spacing-base) 0;
  }
  .sentinel {
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-secondary);
    font-size: var(--fs-sm);
  }
  .loading-more {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/MemoList.svelte
git commit -m "feat: implement infinite scrolling with IntersectionObserver for virtual paging in MemoList"
```

---

### Task 6: 实现 `MemoList.svelte` 空状态与下拉/加载最新提醒联动

**Files:**
- Modify: `src/lib/components/MemoList.svelte`

- [ ] **Step 1: 编写空状态 UI 和顶部加载状态联动**

在 `<script>` 中加入：

```typescript
  import { memoFilter } from '$lib/stores/memos';

  function handleClearFilter() {
    memoFilter.set({
      tag: null,
      search: null,
      onlyPinned: false,
      onlyArchived: false,
      dateRange: null
    });
  }

  async function handleRefresh() {
    await memos.fetchMemos();
  }
</script>
```

在 HTML 顶部与列表渲染中加入刷新栏和空状态检测：

```html
<div class="memo-list-container">
  
  <!-- 顶部拉取状态与刷新区 -->
  <div class="refresh-bar flex justify-between align-center card">
    <span class="count-text">共计 {$filteredMemos.length} 条笔记</span>
    <button class="btn btn-secondary btn-sm refresh-btn" onclick={handleRefresh} disabled={$memos.loading}>
      {#if $memos.loading}
        <span class="spinner inline-spinner"></span>
      {/if}
      加载最新
    </button>
  </div>

  <div class="memo-list">
    {#each displayedMemos as memo (memo.id)}
      <MemoCard {memo} />
    {:else}
      {#if !$memos.loading}
        <div class="empty-state card flex flex-col align-center justify-center">
          <svg viewBox="0 0 24 24" width="48" height="48" stroke="var(--color-text-placeholder)" stroke-width="1.5" fill="none">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <p class="empty-title">暂无笔记内容</p>
          {#if $memoFilter.tag || $memoFilter.search}
            <p class="empty-desc">当前过滤条件下未找到匹配项</p>
            <button class="btn btn-primary btn-sm clear-btn" onclick={handleClearFilter}>清除过滤条件</button>
          {:else}
            <p class="empty-desc">记录你的第一条想法吧！</p>
          {/if}
        </div>
      {/if}
    {/each}
  </div>

  <!-- Sentinel -->
```

在 `<style>` 中加入：

```css
  .refresh-bar {
    padding: var(--spacing-sm) var(--spacing-base);
    background-color: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-base);
  }
  .count-text {
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
  }
  .refresh-btn {
    font-size: var(--fs-xs) !important;
    padding: var(--spacing-xs) var(--spacing-sm) !important;
    gap: var(--spacing-xs);
  }
  .inline-spinner {
    width: 12px;
    height: 12px;
    border-width: 1.5px;
  }
  
  /* 空白状态 */
  .empty-state {
    padding: var(--spacing-2xl) var(--spacing-base);
    text-align: center;
    border-radius: var(--radius-lg);
    background-color: var(--color-card);
  }
  .empty-title {
    margin-top: var(--spacing-base);
    font-size: var(--fs-md);
    color: var(--color-text);
    font-weight: var(--fw-medium);
  }
  .empty-desc {
    font-size: var(--fs-sm);
    color: var(--color-text-secondary);
    margin-top: var(--spacing-xs);
    margin-bottom: var(--spacing-base);
  }
  .clear-btn {
    font-size: var(--fs-xs) !important;
    padding: var(--spacing-xs) var(--spacing-base) !important;
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/MemoList.svelte
git commit -m "feat: add list refresh trigger, empty state layout, and filter clear action"
```

---

### Task 7: 创建 `src/lib/components/SearchModal.svelte` 并注册 Ctrl/Cmd + K 快捷键

**Files:**
- Create: `src/lib/components/SearchModal.svelte`

- [ ] **Step 1: 编写弹窗基础结构、全局快捷键注册与开关逻辑**

```html
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { ui } from '$lib/stores/ui';
  import { memoFilter } from '$lib/stores/memos';

  let inputEl = $state<HTMLInputElement | null>(null);

  // 监听 Ctrl+K 与 Esc 键
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      ui.setSearch(true);
    } else if (e.key === 'Escape' && $ui.searchActive) {
      e.preventDefault();
      handleClose();
    }
  }

  function handleClose() {
    ui.setSearch(false);
  }

  // 订阅 searchActive 的开启，自动聚焦输入框
  $effect(() => {
    if ($ui.searchActive && inputEl) {
      setTimeout(() => inputEl?.focus(), 50);
    }
  });

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });
</script>

{#if $ui.searchActive}
  <div class="search-overlay" onclick={handleClose} transition:fade={{ duration: 150 }}>
    <div class="search-dialog card" onclick={(e) => e.stopPropagation()}>
      <div class="search-header flex align-center">
        <svg class="search-icon" viewBox="0 0 24 24" width="18" height="18" stroke="var(--color-text-placeholder)" stroke-width="2" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input 
          bind:this={inputEl}
          type="text" 
          placeholder="搜索笔记内容或标签..." 
          class="search-input"
          onkeydown={(e) => {
            if (e.key === 'Escape') handleClose();
          }}
        />
        <button class="close-btn" onclick={handleClose}>Esc</button>
      </div>
      <!-- 后面 Task 渲染搜索结果 -->
      <div class="search-results-placeholder">请输入关键词检索笔记...</div>
    </div>
  </div>
{/if}

<style>
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
    padding-top: 10vh;
  }
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
    max-height: 70vh;
    animation: slideUp var(--transition-fast) ease-out;
  }
  @keyframes slideUp {
    from { transform: scale(0.97) translateY(-10px); }
    to { transform: scale(1) translateY(0); }
  }
  .search-header {
    padding: var(--spacing-base);
    border-bottom: 1px solid var(--color-border);
    gap: var(--spacing-md);
  }
  .search-icon {
    flex-shrink: 0;
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
  .close-btn {
    background-color: var(--color-bg);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    font-size: var(--fs-xs);
    padding: 2px var(--spacing-sm);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .close-btn:hover {
    border-color: var(--color-border-hover);
    color: var(--color-text);
  }
  .search-results-placeholder {
    padding: var(--spacing-xl);
    text-align: center;
    font-size: var(--fs-sm);
    color: var(--color-text-secondary);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/SearchModal.svelte
git commit -m "feat: init SearchModal layout with global key bindings for Ctrl+K and Esc"
```

---

### Task 8: 实现 `SearchModal.svelte` 过滤检索与展示联动

**Files:**
- Modify: `src/lib/components/SearchModal.svelte`

- [ ] **Step 1: 订阅过滤检索数据、高亮匹配内容并展示**

在 `SearchModal.svelte` 中，我们需要：
1. 双向绑定输入词，联动过滤。
2. 渲染筛选结果，由于弹窗比较小，我们将结果卡片精简化。
3. 支持双击直接聚焦编辑或跳转。

```html
<!-- 修改 <script> -->
import { filteredMemos } from '$lib/stores/memos';

let query = $state('');

// 联动模糊检索到 store
$effect(() => {
  memoFilter.update(f => ({ ...f, search: query.trim() || null }));
});

// 当弹窗关闭时，还原搜索过滤器
$effect(() => {
  if (!$ui.searchActive) {
    query = '';
  }
});

// 提取 HTML 文本内容去标签用于预览
function stripHtml(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  } catch (e) {
    return html.replace(/<[^>]*>/g, '');
  }
}

// 激活并编辑对应的笔记
function handleSelectMemo(memo: any) {
  handleClose();
  ui.setActiveMemoId(memo.id);
  ui.setMemoDraft(memo.content);
  ui.setEditModalOpen(true);
}
```

在 HTML 中，替换 `.search-results-placeholder` 部分：

```html
      <!-- 搜索结果渲染列表 -->
      <div class="search-results">
        {#each $filteredMemos as memo (memo.id)}
          <button class="result-item" onclick={() => handleSelectMemo(memo)}>
            <div class="result-meta flex justify-between align-center">
              <span class="result-date">{new Date(memo.createdAt).toLocaleDateString()}</span>
              {#if memo.isPinned}
                <span class="pin-badge">置顶</span>
              {/if}
            </div>
            <div class="result-text">{stripHtml(memo.content)}</div>
          </button>
        {:else}
          <div class="no-results flex flex-col align-center justify-center">
            <p>未找到匹配的笔记</p>
          </div>
        {/each}
      </div>
```

在 `<style>` 中加入：

```css
  .search-results {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-sm);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
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
  }
  .result-item:hover {
    background-color: var(--color-bg);
  }
  .result-meta {
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
  }
  .pin-badge {
    background-color: var(--color-primary-light);
    color: var(--color-primary);
    padding: 1px 4px;
    border-radius: var(--radius-sm);
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
  .no-results {
    padding: var(--spacing-xl);
    color: var(--color-text-secondary);
    font-size: var(--fs-sm);
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/SearchModal.svelte
git commit -m "feat: link search query with filteredMemos store and support clicking search result to edit"
```

---

### Task 9: 集成到 `src/routes/+page.svelte` 进行功能演练与测试

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: 在主页中集成并初始化拉取数据**

```html
<script lang="ts">
  import { onMount } from 'svelte';
  import { memos } from '$lib/stores/memos';
  import { ui } from '$lib/stores/ui';
  import MemoList from '$lib/components/MemoList.svelte';
  import SearchModal from '$lib/components/SearchModal.svelte';

  onMount(() => {
    // 首次载入加载笔记
    memos.fetchMemos();
  });
</script>

<div class="app-layout flex">
  <main class="main-content flex-1">
    <!-- 顶部状态栏 -->
    <header class="app-header flex justify-between align-center">
      <div class="brand flex align-center">
        <span class="logo">MemoFlow</span>
      </div>
      <div class="actions flex align-center">
        <button class="search-trigger btn btn-secondary flex align-center" onclick={() => ui.setSearch(true)}>
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" class="search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          搜索 (Ctrl+K)
        </button>
      </div>
    </header>

    <!-- 笔记时间流 -->
    <MemoList />
  </main>
</div>

<!-- 全局搜索弹窗 -->
<SearchModal />

<style>
  .app-layout {
    background-color: var(--color-bg);
    min-height: 100vh;
    font-family: var(--font-sans);
  }
  .main-content {
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 0 var(--spacing-base);
  }
  .app-header {
    height: var(--header-height);
    border-bottom: 1px solid var(--color-border);
    background-color: var(--color-card);
    margin-bottom: var(--spacing-lg);
    padding: 0 var(--spacing-base);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  }
  .logo {
    font-size: var(--fs-lg);
    font-weight: var(--fw-bold);
    color: var(--color-primary);
  }
  .search-trigger {
    font-size: var(--fs-xs) !important;
    gap: var(--spacing-sm);
    padding: var(--spacing-xs) var(--spacing-base) !important;
  }
  .search-icon {
    color: var(--color-text-secondary);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "test: integrate MemoList and SearchModal in page and fetch initial data"
```
