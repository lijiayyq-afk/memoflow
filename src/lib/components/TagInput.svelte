<!-- src/lib/components/TagInput.svelte -->
<script lang="ts">
  import { tagsList } from '$lib/stores/tags';

  // Svelte 5 props
  let { onSelect } = $props<{
    onSelect: (tagName: string) => void;
  }>();

  let inputVal = $state('');

  // 过滤展示的已有标签：如果为空，展示最常使用的 10 个；如果不为空，根据输入过滤
  let filteredTags = $derived(
    inputVal.trim() === ''
      ? $tagsList.slice(0, 10)
      : $tagsList.filter(t => t.toLowerCase().includes(inputVal.toLowerCase().trim()))
  );

  // 触发选择，传递标签名给编辑器
  function handleSelect(tag: string) {
    onSelect(tag);
    inputVal = '';
  }

  // 监听回车按键，允许快捷插入自创标签
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && inputVal.trim()) {
      e.preventDefault();
      handleSelect(inputVal.trim());
    }
  }
</script>

<div class="tag-input-panel">
  <div class="tag-search-wrapper">
    <svg class="hash-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <line x1="4" y1="9" x2="20" y2="9"></line>
      <line x1="4" y1="15" x2="20" y2="15"></line>
      <line x1="10" y1="3" x2="8" y2="21"></line>
      <line x1="16" y1="3" x2="14" y2="21"></line>
    </svg>
    <input 
      type="text" 
      placeholder="快捷标签筛选/回车直接添加..."
      bind:value={inputVal}
      onkeydown={handleKeyDown}
    />
  </div>
  
  <div class="quick-tags-container">
    {#each filteredTags as tag}
      <button 
        type="button" 
        class="quick-tag-btn"
        onclick={() => handleSelect(tag)}
        title="点击插入此标签"
      >
        #{tag}
      </button>
    {/each}

    {#if filteredTags.length === 0 && inputVal.trim()}
      <button 
        type="button" 
        class="quick-tag-btn create-new"
        onclick={() => handleSelect(inputVal.trim())}
        title="插入新标签"
      >
        + 新标签: #{inputVal.trim()}
      </button>
    {/if}
  </div>
</div>

<style>
  .tag-input-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: var(--color-bg);
    border-radius: var(--radius-md);
    border: 1px dashed var(--color-border);
  }

  .tag-search-wrapper {
    display: flex;
    align-items: center;
    background-color: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 0 var(--spacing-sm);
    height: 28px;
    transition: border-color var(--transition-fast);
  }

  .tag-search-wrapper:focus-within {
    border-color: var(--color-primary);
  }

  .hash-icon {
    color: var(--color-text-secondary);
    margin-right: var(--spacing-xs);
  }

  .tag-search-wrapper input {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    font-size: var(--fs-xs);
    color: var(--color-text);
  }

  .tag-search-wrapper input::placeholder {
    color: var(--color-text-placeholder);
  }

  .quick-tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
    max-height: 80px;
    overflow-y: auto;
    /* 隐藏滚动条 */
    scrollbar-width: none;
  }

  .quick-tags-container::-webkit-scrollbar {
    display: none;
  }

  .quick-tag-btn {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 var(--spacing-sm);
    border-radius: var(--radius-round);
    border: 1px solid var(--color-border);
    background-color: var(--color-card);
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }

  .quick-tag-btn:hover {
    border-color: var(--color-primary);
    background-color: var(--color-primary-light);
    color: var(--color-primary);
  }

  .quick-tag-btn.create-new {
    border-style: dashed;
    border-color: var(--color-primary);
    color: var(--color-primary);
    background-color: var(--color-primary-light);
  }

  .quick-tag-btn.create-new:hover {
    background-color: var(--color-primary);
    color: #fff;
  }
</style>
