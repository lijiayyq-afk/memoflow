<!-- TagTree.svelte - MemoFlow 递归层级标签树组件 -->
<script lang="ts">
  import { tagsTree, tags } from '$lib/stores/tags';
  import { memoFilter, memos } from '$lib/stores/memos';
  import type { TagNode } from '$lib/types';
  import TagTree from './TagTree.svelte';
  
  // Props 定义
  // node: 当前标签节点，若为 null 则代表根节点（开始遍历 $tagsTree）
  // depth: 缩进深度
  let { node = null, depth = 0 } = $props<{ node?: TagNode | null, depth?: number }>();
  
  // 是否展开（默认展开）
  let expanded = $state(true);
  // 操作菜单是否显示
  let menuOpen = $state(false);
  // 原地编辑状态: 'idle' | 'rename' | 'merge'
  let editMode = $state<'idle' | 'rename' | 'merge'>('idle');
  // 编辑框输入值
  let editValue = $state('');

  // 派生出子节点
  let children = $derived(node ? node.children : $tagsTree);
  // 判断当前节点是否被选中
  let isSelected = $derived(node ? $memoFilter.tag === node.path : false);

  // 展开折叠切换
  function toggleExpand(e: Event) {
    e.stopPropagation();
    expanded = !expanded;
  }

  // 选中标签进行筛选
  function handleSelect() {
    if (!node) return;
    if (isSelected) {
      // 已经选中，再次点击取消筛选
      memoFilter.update(f => ({ ...f, tag: null }));
    } else {
      // 否则筛选当前标签
      memoFilter.update(f => ({ ...f, tag: node!.path }));
    }
  }

  // 关闭菜单
  function closeMenu() {
    menuOpen = false;
  }

  // 触发重命名
  function startRename(e: Event) {
    e.stopPropagation();
    if (!node) return;
    editValue = node.name;
    editMode = 'rename';
    menuOpen = false;
  }

  // 触发合并
  function startMerge(e: Event) {
    e.stopPropagation();
    if (!node) return;
    editValue = '';
    editMode = 'merge';
    menuOpen = false;
  }

  // 取消编辑
  function cancelEdit() {
    editMode = 'idle';
    editValue = '';
  }

  // 确认编辑（重命名或合并）
  async function submitEdit() {
    if (!node || !editValue.trim()) return;
    const val = editValue.trim();
    
    try {
      if (editMode === 'rename') {
        // 构建新的完整路径
        const parts = node.path.split('/');
        parts[parts.length - 1] = val;
        const newPath = parts.join('/');
        
        if (newPath === node.path) {
          editMode = 'idle';
          return;
        }

        await tags.renameTag(node.path, newPath);
      } else if (editMode === 'merge') {
        // 合并：将 node.path 重命名为已有的标签路径 val
        if (val === node.path) {
          editMode = 'idle';
          return;
        }
        await tags.renameTag(node.path, val);
      }
      
      // 成功后，同步刷新笔记和标签
      await memos.fetchMemos();
      
      // 如果当前筛选的是被修改的标签，更新筛选器
      if ($memoFilter.tag === node.path) {
        if (editMode === 'rename') {
          const parts = node.path.split('/');
          parts[parts.length - 1] = val;
          const newPath = parts.join('/');
          memoFilter.update(f => ({ ...f, tag: newPath }));
        } else {
          memoFilter.update(f => ({ ...f, tag: val }));
        }
      }
      
      editMode = 'idle';
    } catch (err: any) {
      alert(err.message || '操作失败');
    }
  }

  // 删除标签
  async function handleDelete(e: Event) {
    e.stopPropagation();
    if (!node) return;
    menuOpen = false;
    
    const confirmDelete = confirm(`确认删除标签 "${node.name}" 及其所有子标签吗？\n这会从所有相关笔记中移除该标签。`);
    if (!confirmDelete) return;

    try {
      await tags.deleteTag(node.path);
      // 成功后重新拉取
      await memos.fetchMemos();
      
      // 如果筛选中包含已删除标签，清除筛选
      if ($memoFilter.tag === node.path || $memoFilter.tag?.startsWith(node.path + '/')) {
        memoFilter.update(f => ({ ...f, tag: null }));
      }
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  }

  // 点击空白处关闭下拉菜单
  function handleGlobalClick() {
    if (menuOpen) {
      closeMenu();
    }
  }
</script>

<svelte:window onclick={handleGlobalClick} />

{#if node === null}
  <!-- 根层级容器 -->
  <div class="tag-tree-container">
    {#if children.length === 0}
      <div class="empty-tags">暂无标签</div>
    {:else}
      {#each children as child}
        <TagTree node={child} depth={0} />
      {/each}
    {/if}
  </div>
{:else}
  <!-- 单个标签项节点 -->
  <div class="tag-node-wrapper" style="--depth: {depth}">
    <div 
      class="tag-item-row" 
      class:selected={isSelected} 
      role="button" 
      tabindex="0"
      onclick={handleSelect}
      onkeydown={(e) => e.key === 'Enter' && handleSelect()}
    >
      <!-- 左侧：展开折叠箭头 -->
      <div class="arrow-container">
        {#if node.children && node.children.length > 0}
          <button 
            class="arrow-btn" 
            class:expanded={expanded} 
            onclick={toggleExpand}
            aria-label={expanded ? '折叠' : '展开'}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        {/if}
      </div>

      <!-- 中间：标签名（编辑态/常规态） -->
      <div class="tag-content">
        {#if editMode === 'rename'}
          <div class="inline-edit-form" onclick={e => e.stopPropagation()} role="presentation">
            <input 
              type="text" 
              bind:value={editValue} 
              class="edit-input" 
              autofocus
              onkeydown={e => {
                if (e.key === 'Enter') submitEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
            />
            <button class="edit-btn confirm" onclick={submitEdit} title="保存">✓</button>
            <button class="edit-btn cancel" onclick={cancelEdit} title="取消">✕</button>
          </div>
        {:else if editMode === 'merge'}
          <div class="inline-edit-form" onclick={e => e.stopPropagation()} role="presentation">
            <input 
              type="text" 
              placeholder="合并至标签(如: 工作/周报)" 
              bind:value={editValue} 
              class="edit-input merge" 
              onkeydown={e => {
                if (e.key === 'Enter') submitEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
            />
            <button class="edit-btn confirm" onclick={submitEdit} title="合并">合并</button>
            <button class="edit-btn cancel" onclick={cancelEdit} title="取消">✕</button>
          </div>
        {:else}
          <span class="tag-name">#{node.name}</span>
        {/if}
      </div>

      <!-- 右侧：数量 & 更多操作 -->
      {#if editMode === 'idle'}
        <div class="tag-meta" onclick={e => e.stopPropagation()} role="presentation">
          <span class="tag-count">{node.memoCount}</span>
          
          <div class="more-menu-wrapper">
            <button 
              class="more-btn" 
              onclick={(e) => {
                e.stopPropagation();
                menuOpen = !menuOpen;
              }}
              aria-label="更多操作"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="19" cy="12" r="1"></circle>
                <circle cx="5" cy="12" r="1"></circle>
              </svg>
            </button>

            {#if menuOpen}
              <div class="more-dropdown">
                <button onclick={startRename}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path>
                  </svg>
                  重命名
                </button>
                <button onclick={startMerge}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
                    <path d="M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101"></path>
                    <path d="M9 9L15 15"></path>
                    <path d="M10.172 13.828a4 4 0 0 0 5.656 0l4-4a4 4 0 1 0-5.656-5.656l-1.1 1.1"></path>
                  </svg>
                  合并标签
                </button>
                <hr />
                <button class="delete-opt" onclick={handleDelete}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  删除标签
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- 子节点递归展示 -->
    {#if node.children && node.children.length > 0 && expanded}
      <div class="tag-children-container">
        {#each node.children as child}
          <TagTree node={child} depth={depth + 1} />
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .tag-tree-container {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .empty-tags {
    font-size: var(--fs-sm);
    color: var(--color-text-secondary);
    padding: var(--spacing-sm) var(--spacing-base);
    text-align: center;
  }

  .tag-node-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .tag-item-row {
    display: flex;
    align-items: center;
    padding: 6px var(--spacing-sm);
    padding-left: calc(var(--spacing-sm) + var(--depth) * 16px);
    border-radius: var(--radius-sm);
    cursor: pointer;
    user-select: none;
    transition: background-color var(--transition-fast);
    position: relative;
    height: 32px;
  }

  .tag-item-row:hover {
    background-color: rgba(0, 0, 0, 0.03);
  }

  .tag-item-row.selected {
    background-color: var(--color-primary-light);
    color: var(--color-primary);
    font-weight: var(--fw-medium);
  }

  .arrow-container {
    width: 16px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 4px;
  }

  .arrow-btn {
    background: none;
    border: none;
    padding: 0;
    color: var(--color-text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform var(--transition-fast);
  }

  .arrow-btn.expanded {
    transform: rotate(90deg);
  }

  .tag-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    align-items: center;
  }

  .tag-name {
    font-size: var(--fs-sm);
    color: inherit;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }

  .tag-meta {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .tag-count {
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
    background-color: rgba(0, 0, 0, 0.04);
    padding: 1px 6px;
    border-radius: 10px;
    min-width: 20px;
    text-align: center;
  }

  .tag-item-row.selected .tag-count {
    background-color: rgba(43, 190, 115, 0.12);
    color: var(--color-primary);
  }

  .more-btn {
    background: none;
    border: none;
    padding: 2px;
    color: var(--color-text-secondary);
    opacity: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    transition: opacity var(--transition-fast), background-color var(--transition-fast);
  }

  .tag-item-row:hover .more-btn,
  .more-menu-wrapper:focus-within .more-btn {
    opacity: 1;
  }

  .more-btn:hover {
    background-color: rgba(0, 0, 0, 0.05);
    color: var(--color-text);
  }

  .more-menu-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .more-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background-color: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    z-index: 100;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-xs) 0;
    min-width: 100px;
  }

  .more-dropdown button {
    background: none;
    border: none;
    text-align: left;
    padding: 6px var(--spacing-base);
    font-size: var(--fs-xs);
    color: var(--color-text);
    cursor: pointer;
    white-space: nowrap;
    display: flex;
    align-items: center;
  }

  .more-dropdown button:hover {
    background-color: var(--color-bg);
  }

  .more-dropdown hr {
    border: none;
    border-top: 1px solid var(--color-border);
    margin: var(--spacing-xs) 0;
  }

  .more-dropdown button.delete-opt {
    color: var(--color-danger);
  }

  .more-dropdown button.delete-opt:hover {
    background-color: var(--color-danger-light);
  }

  .tag-children-container {
    border-left: 1px dashed var(--color-border);
    margin-left: calc(var(--spacing-sm) + var(--depth) * 16px + 8px);
    padding-left: 4px;
    margin-top: 2px;
    margin-bottom: 2px;
  }

  /* 行内编辑表单 */
  .inline-edit-form {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
  }

  .edit-input {
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
    padding: 2px 6px;
    font-size: var(--fs-xs);
    outline: none;
    width: 80px;
    height: 22px;
    background-color: var(--color-card);
    color: var(--color-text);
  }

  .edit-input.merge {
    width: 140px;
  }

  .edit-btn {
    border: none;
    background-color: var(--color-bg);
    color: var(--color-text-secondary);
    border-radius: var(--radius-sm);
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: var(--fs-xs);
    font-weight: var(--fw-medium);
  }

  .edit-btn:hover {
    background-color: var(--color-border);
    color: var(--color-text);
  }

  .edit-btn.confirm {
    background-color: var(--color-primary);
    color: white;
  }

  .edit-btn.confirm:hover {
    background-color: var(--color-primary-hover);
  }
</style>
