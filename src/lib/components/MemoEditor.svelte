<!-- MemoEditor.svelte - MemoFlow 笔记编辑器组件 -->
<script lang="ts">
  import { memos } from '$lib/stores/memos';
  import { tagsList, suggestTags } from '$lib/stores/tags';
  import { apiFetch } from '$lib/api';
  import { onMount } from 'svelte';

  // 编辑内容
  let content = $state('');
  // 暂存上传成功的文件资源列表
  let uploadedResources = $state<{ id: string; filename: string; mimeType: string; url: string }[]>([]);
  // Props 属性声明：支持 onsaved 回调
  let { 
    onsaved 
  }: { 
    onsaved?: () => void 
  } = $props();
  // 上传 loading 状态
  let uploading = $state(false);
  
  // 标签建议下拉状态
  let showSuggestions = $state(false);
  let suggestions = $state<string[]>([]);
  let suggestionQuery = $state('');
  let textareaElement = $state<HTMLTextAreaElement | null>(null);
  let cursorPosition = $state(0);

  // 输入监听，检测标签联想
  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    const value = target.value;
    const pos = target.selectionStart;
    cursorPosition = pos;

    // 寻找光标前最近的一个 '#' 字符
    const textBeforeCursor = value.slice(0, pos);
    const lastHashIndex = textBeforeCursor.lastIndexOf('#');

    if (lastHashIndex !== -1) {
      // 检查 '#' 到光标之间是否有空格或换行，如果有，说明不是正在输入的标签
      const term = textBeforeCursor.slice(lastHashIndex + 1);
      if (!/\s/.test(term)) {
        showSuggestions = true;
        suggestionQuery = term;
        suggestions = suggestTags(term, $tagsList);
        return;
      }
    }
    
    showSuggestions = false;
  }

  // 插入建议标签
  function selectSuggestion(tagName: string) {
    if (!textareaElement) return;

    const value = content;
    const pos = cursorPosition;
    const textBeforeCursor = value.slice(0, pos);
    const lastHashIndex = textBeforeCursor.lastIndexOf('#');

    if (lastHashIndex !== -1) {
      const before = value.slice(0, lastHashIndex);
      const after = value.slice(pos);
      // 拼接：#标签名，并补上一个空格
      content = `${before}#${tagName} ${after}`;
      
      // 重新定位光标
      const newPos = lastHashIndex + tagName.length + 2;
      setTimeout(() => {
        textareaElement!.focus();
        textareaElement!.setSelectionRange(newPos, newPos);
      }, 0);
    }
    showSuggestions = false;
  }

  // 处理文件上传
  async function handleFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    uploading = true;
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      // 上传至后端
      const res = await apiFetch<{ id: string; filename: string; file_key: string; mime_type: string; size: number }>('/memos/upload', {
        method: 'POST',
        body: formData
      });

      // 保存至已上传列表
      uploadedResources.push({
        id: res.id,
        filename: res.filename,
        mimeType: res.mime_type,
        url: `/api/memos/resources/${res.file_key}`
      });
    } catch (err: any) {
      alert(err.message || '上传文件失败');
    } finally {
      uploading = false;
      input.value = ''; // 重置文件 input
    }
  }

  // 移除上传的文件
  function removeResource(id: string) {
    uploadedResources = uploadedResources.filter(r => r.id !== id);
  }

  // 保存笔记
  async function saveMemo() {
    if (!content.trim() && uploadedResources.length === 0) return;

    try {
      const resourceIds = uploadedResources.map(r => r.id);
      await memos.createMemo(content.trim(), resourceIds);
      
      // 清空状态
      content = '';
      uploadedResources = [];
      if (onsaved) onsaved();
    } catch (err: any) {
      alert(err.message || '保存笔记失败');
    }
  }

  // 监听 Ctrl+Enter 快捷键
  function handleKeyDown(e: KeyboardEvent) {
    if (e.ctrlKey && e.key === 'Enter') {
      saveMemo();
    }
  }
</script>

<div class="memo-editor-card card">
  <div class="editor-wrapper">
    <textarea
      bind:this={textareaElement}
      bind:value={content}
      placeholder="输入 # 即可创建标签，Ctrl + Enter 快速保存..."
      oninput={handleInput}
      onkeydown={handleKeyDown}
      rows="4"
    ></textarea>

    <!-- 标签联想建议悬浮层 -->
    {#if showSuggestions && suggestions.length > 0}
      <div class="suggestions-dropdown">
        {#each suggestions as tag}
          <button class="suggestion-item" onclick={() => selectSuggestion(tag)}>
            #{tag}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- 上传文件的预览区域 -->
  {#if uploadedResources.length > 0}
    <div class="resources-preview-list">
      {#each uploadedResources as res}
        <div class="resource-preview-item">
          {#if res.mimeType.startsWith('image/')}
            <img src={res.url} alt={res.filename} class="preview-img" />
          {:else if res.mimeType.startsWith('audio/')}
            <div class="preview-audio-container">
              <span class="music-icon">🎙️</span>
              <span class="filename truncate">{res.filename}</span>
            </div>
          {:else}
            <div class="preview-file-container">
              <span class="file-icon">📎</span>
              <span class="filename truncate">{res.filename}</span>
            </div>
          {/if}
          <button class="remove-resource-btn" onclick={() => removeResource(res.id)} title="移除文件">✕</button>
        </div>
      {/each}
    </div>
  {/if}

  <div class="editor-actions">
    <!-- 左侧上传附件 -->
    <div class="left-actions">
      <label class="action-btn-label" title="上传图片/音频">
        <input 
          type="file" 
          accept="image/*,audio/*" 
          onchange={handleFileUpload} 
          disabled={uploading} 
          class="file-hidden-input" 
        />
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <span>{uploading ? '上传中...' : '附件'}</span>
      </label>
    </div>

    <!-- 右侧保存按钮 -->
    <div class="right-actions">
      <button 
        class="btn btn-primary save-btn" 
        onclick={saveMemo} 
        disabled={(!content.trim() && uploadedResources.length === 0) || uploading}
      >
        保存
      </button>
    </div>
  </div>
</div>

<style>
  .memo-editor-card {
    padding: var(--spacing-base);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    position: relative;
    box-shadow: var(--shadow-sm);
  }

  .editor-wrapper {
    position: relative;
    width: 100%;
  }

  textarea {
    width: 100%;
    border: none;
    resize: none;
    font-size: var(--fs-base);
    color: var(--color-text);
    background-color: transparent;
    outline: none;
    line-height: var(--lh-base);
    padding: 0;
  }

  textarea::placeholder {
    color: var(--color-text-placeholder);
  }

  /* 联想建议列表 */
  .suggestions-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    background-color: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    max-height: 200px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-xs) 0;
    min-width: 150px;
  }

  .suggestion-item {
    background: none;
    border: none;
    text-align: left;
    padding: 8px var(--spacing-base);
    font-size: var(--fs-sm);
    color: var(--color-text);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .suggestion-item:hover {
    background-color: var(--color-bg);
    color: var(--color-primary);
  }

  /* 上传文件预览区域 */
  .resources-preview-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    padding-top: var(--spacing-xs);
    border-top: 1px solid rgba(0, 0, 0, 0.03);
  }

  .resource-preview-item {
    position: relative;
    width: 72px;
    height: 72px;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--color-border);
    background-color: var(--color-bg);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .preview-audio-container, .preview-file-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xs);
    width: 100%;
    height: 100%;
  }

  .music-icon, .file-icon {
    font-size: var(--fs-xl);
    margin-bottom: 2px;
  }

  .filename {
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
    width: 100%;
    text-align: center;
  }

  .remove-resource-btn {
    position: absolute;
    top: 2px;
    right: 2px;
    background-color: rgba(0, 0, 0, 0.5);
    color: #ffffff;
    border: none;
    border-radius: var(--radius-round);
    width: 16px;
    height: 16px;
    font-size: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .remove-resource-btn:hover {
    background-color: rgba(0, 0, 0, 0.7);
  }

  /* 操作行 */
  .editor-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid var(--color-border);
    padding-top: var(--spacing-sm);
    margin-top: var(--spacing-xs);
  }

  .file-hidden-input {
    display: none;
  }

  .action-btn-label {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: color var(--transition-fast);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
  }

  .action-btn-label:hover {
    color: var(--color-primary);
    background-color: var(--color-primary-light);
  }

  .save-btn {
    height: 32px;
    padding: 0 var(--spacing-base);
    font-size: var(--fs-sm);
  }
</style>
