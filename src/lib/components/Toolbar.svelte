<!-- src/lib/components/Toolbar.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  
  // Svelte 5 props
  let { editor, onUploadClick, onInsertTagClick } = $props<{
    editor: any;
    onUploadClick?: () => void;
    onInsertTagClick?: () => void;
  }>();

  // 状态变量，判断当前光标处格式状态
  let isBold = $state(false);
  let isItalic = $state(false);
  let isUnderline = $state(false);
  let isHighlight = $state(false);
  let isBulletList = $state(false);
  let isOrderedList = $state(false);

  // 更新格式的激活状态
  function updateActiveStates() {
    if (!editor) return;
    isBold = editor.isActive('bold');
    isItalic = editor.isActive('italic');
    isUnderline = editor.isActive('underline');
    isHighlight = editor.isActive('highlight');
    isBulletList = editor.isActive('bulletList');
    isOrderedList = editor.isActive('orderedList');
  }

  // 监听 Tiptap 编辑器的选择和事务更新
  $effect(() => {
    if (editor) {
      editor.on('transaction', updateActiveStates);
      editor.on('selectionUpdate', updateActiveStates);
      
      // 初始化状态
      updateActiveStates();

      return () => {
        editor.off('transaction', updateActiveStates);
        editor.off('selectionUpdate', updateActiveStates);
      };
    }
  });

  // 执行加粗
  function toggleBold() {
    editor?.chain().focus().toggleBold().run();
  }

  // 执行斜体
  function toggleItalic() {
    editor?.chain().focus().toggleItalic().run();
  }

  // 执行下划线
  function toggleUnderline() {
    editor?.chain().focus().toggleUnderline().run();
  }

  // 执行高亮
  function toggleHighlight() {
    editor?.chain().focus().toggleHighlight().run();
  }

  // 执行无序列表
  function toggleBulletList() {
    editor?.chain().focus().toggleBulletList().run();
  }

  // 执行有序列表
  function toggleOrderedList() {
    editor?.chain().focus().toggleOrderedList().run();
  }
</script>

<div class="toolbar">
  <div class="toolbar-left">
    <!-- 标签插入按钮 -->
    <button 
      type="button" 
      class="toolbar-btn" 
      title="插入标签"
      onclick={onInsertTagClick}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <line x1="4" y1="9" x2="20" y2="9"></line>
        <line x1="4" y1="15" x2="20" y2="15"></line>
        <line x1="10" y1="3" x2="8" y2="21"></line>
        <line x1="16" y1="3" x2="14" y2="21"></line>
      </svg>
    </button>

    <!-- 图片上传按钮 -->
    <button 
      type="button" 
      class="toolbar-btn" 
      title="上传图片"
      onclick={onUploadClick}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
    </button>

    <div class="divider"></div>

    <!-- 加粗按钮 -->
    <button 
      type="button" 
      class="toolbar-btn" 
      class:active={isBold}
      title="加粗 (Ctrl+B)"
      onclick={toggleBold}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
        <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
      </svg>
    </button>

    <!-- 斜体按钮 -->
    <button 
      type="button" 
      class="toolbar-btn" 
      class:active={isItalic}
      title="斜体 (Ctrl+I)"
      onclick={toggleItalic}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="4" x2="10" y2="4"></line>
        <line x1="14" y1="20" x2="5" y2="20"></line>
        <line x1="15" y1="4" x2="9" y2="20"></line>
      </svg>
    </button>

    <!-- 下划线按钮 -->
    <button 
      type="button" 
      class="toolbar-btn" 
      class:active={isUnderline}
      title="下划线"
      onclick={toggleUnderline}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path>
        <line x1="4" y1="21" x2="20" y2="21"></line>
      </svg>
    </button>

    <!-- 高亮按钮 -->
    <button 
      type="button" 
      class="toolbar-btn" 
      class:active={isHighlight}
      title="高亮"
      onclick={toggleHighlight}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
        <path d="M12 8v8" />
        <path d="M8 12h8" />
      </svg>
    </button>

    <div class="divider"></div>

    <!-- 无序列表 -->
    <button 
      type="button" 
      class="toolbar-btn" 
      class:active={isBulletList}
      title="无序列表"
      onclick={toggleBulletList}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <circle cx="3" cy="6" r="1"></circle>
        <circle cx="3" cy="12" r="1"></circle>
        <circle cx="3" cy="18" r="1"></circle>
      </svg>
    </button>

    <!-- 有序列表 -->
    <button 
      type="button" 
      class="toolbar-btn" 
      class:active={isOrderedList}
      title="有序列表"
      onclick={toggleOrderedList}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <line x1="10" y1="6" x2="21" y2="6"></line>
        <line x1="10" y1="12" x2="21" y2="12"></line>
        <line x1="10" y1="18" x2="21" y2="18"></line>
        <path d="M4 6H5v4M3 10h3"></path>
        <path d="M4 14h2a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H4a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h3"></path>
      </svg>
    </button>
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm) 0;
    border-top: 1px solid var(--color-border);
    background-color: transparent;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: var(--color-text-secondary);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .toolbar-btn:hover {
    background-color: var(--color-bg);
    color: var(--color-text);
  }

  .toolbar-btn.active {
    background-color: var(--color-primary-light);
    color: var(--color-primary);
  }

  .divider {
    width: 1px;
    height: 16px;
    background-color: var(--color-border);
    margin: 0 var(--spacing-xs);
  }
</style>
