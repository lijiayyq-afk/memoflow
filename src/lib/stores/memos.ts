/* memos.ts - 笔记管理状态 Store，支持置顶、归档、标签提取和前端多维过滤 */

import { writable, derived } from 'svelte/store';
import { apiFetch } from '$lib/api';
import type { Memo, MemoFilter } from '$lib/types';
import { tags } from '$lib/stores/tags'; // 引入 tags store 以便在笔记变更时联动更新标签
import { trash } from '$lib/stores/trash'; // 引入回收站 store

interface MemosState {
  items: Memo[];
  loading: boolean;
  error: string | null;
}

const initialMemosState: MemosState = {
  items: [],
  loading: false,
  error: null
};

// 初始过滤条件
const initialFilter: MemoFilter = {
  tag: null,
  search: null,
  onlyPinned: false,
  onlyArchived: false,
  dateRange: null,
  specialFilter: null
};

// 正则表达式：解析 #tag 或 #tag/subtag，支持中文和斜杠多级标签，排除单纯的 # 和十六进制颜色值如 #fff
export function extractTags(content: string): string[] {
  if (!content) return [];
  // 匹配规则：以空格、换行或开头为界，后面跟着 #，然后是非空白且不包含 # 的字符
  const regex = /(?:^|\s)#([^\s#]+)/g;
  const foundTags: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const tag = match[1].trim();
    // 排除纯数字或无效标签
    if (tag && !/^\d+$/.test(tag) && !foundTags.includes(tag)) {
      foundTags.push(tag);
    }
  }
  return foundTags;
}

function createMemosStore() {
  const { subscribe, set, update } = writable<MemosState>(initialMemosState);

  // 1. 获取所有笔记
  async function fetchMemos() {
    update(s => ({ ...s, loading: true, error: null }));
    try {
      const items = await apiFetch<Memo[]>('/memos');
      // 按照置顶和时间排序：置顶优先，其次按创建时间倒序
      const sortedItems = sortMemos(items);
      set({ items: sortedItems, loading: false, error: null });
      
      // 同步更新 tags 列表
      syncTagsFromMemos(sortedItems);
    } catch (err: any) {
      update(s => ({ ...s, loading: false, error: err.message || '获取笔记失败' }));
    }
  }

  // 2. 创建笔记
  async function createMemo(content: string, resourceIds?: string[]) {
    update(s => ({ ...s, loading: true }));
    try {
      const parsedTags = extractTags(content);
      const newMemo = await apiFetch<Memo>('/memos', {
        method: 'POST',
        body: JSON.stringify({
          content,
          tags: parsedTags,
          resourceIds
        })
      });

      update(s => {
        const newItems = sortMemos([newMemo, ...s.items]);
        syncTagsFromMemos(newItems);
        return { ...s, items: newItems, loading: false };
      });
      return newMemo;
    } catch (err: any) {
      update(s => ({ ...s, loading: false, error: err.message || '新建笔记失败' }));
      throw err;
    }
  }

  // 3. 更新笔记内容或状态
  async function updateMemo(id: string, updates: { content?: string; isPinned?: boolean; isArchived?: boolean; resourceIds?: string[] }) {
    try {
      const body: any = { ...updates };
      if (updates.content !== undefined) {
        body.tags = extractTags(updates.content);
      }

      const updatedMemo = await apiFetch<Memo>(`/memos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      });

      update(s => {
        const newItems = s.items.map(item => item.id === id ? updatedMemo : item);
        const sortedItems = sortMemos(newItems);
        syncTagsFromMemos(sortedItems);
        return { ...s, items: sortedItems };
      });
      return updatedMemo;
    } catch (err: any) {
      update(s => ({ ...s, error: err.message || '修改笔记失败' }));
      throw err;
    }
  }

  // 4. 删除笔记
  async function deleteMemo(id: string) {
    try {
      // 备份到回收站
      update(s => {
        const item = s.items.find(m => m.id === id);
        if (item) {
          trash.moveToTrash(item);
        }
        return s;
      });

      await apiFetch(`/memos/${id}`, {
        method: 'DELETE'
      });

      update(s => {
        const newItems = s.items.filter(item => item.id !== id);
        syncTagsFromMemos(newItems);
        return { ...s, items: newItems };
      });
    } catch (err: any) {
      update(s => ({ ...s, error: err.message || '删除笔记失败' }));
      throw err;
    }
  }

  // 5. 切换置顶
  async function togglePin(id: string) {
    update(s => {
      const memo = s.items.find(item => item.id === id);
      if (memo) {
        updateMemo(id, { isPinned: !memo.isPinned });
      }
      return s;
    });
  }

  // 6. 切换归档
  async function toggleArchive(id: string) {
    update(s => {
      const memo = s.items.find(item => item.id === id);
      if (memo) {
        updateMemo(id, { isArchived: !memo.isArchived });
      }
      return s;
    });
  }

  // 辅助：排序逻辑（置顶置于最前，然后按时间降序）
  function sortMemos(memosList: Memo[]): Memo[] {
    return [...memosList].sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  // 辅助：根据笔记中的标签变化同步到 tags store
  function syncTagsFromMemos(memosList: Memo[]) {
    const tagCountMap: Record<string, number> = {};
    memosList.forEach(memo => {
      // 归档的笔记标签不计入活跃展示 (可根据设计调整)
      if (memo.isArchived) return;
      memo.tags.forEach(tag => {
        tagCountMap[tag] = (tagCountMap[tag] || 0) + 1;
      });
    });
    tags.setTagsFromMap(tagCountMap);
  }

  return {
    subscribe,
    fetchMemos,
    createMemo,
    updateMemo,
    deleteMemo,
    togglePin,
    toggleArchive,
    syncTagsFromMemos
  };
}

// 导出笔记列表 Store
export const memos = createMemosStore();

// 过滤条件 Store
export const memoFilter = writable<MemoFilter>({ ...initialFilter });

// 派生 Store：根据过滤条件过滤后的笔记列表
export const filteredMemos = derived(
  [memos, memoFilter],
  ([$memos, $filter]) => {
    return $memos.items.filter(memo => {
      // 1. 归档过滤：如果 explicit 要求 onlyArchived，则只显示归档；否则默认不显示归档
      if ($filter.onlyArchived) {
        if (!memo.isArchived) return false;
      } else {
        if (memo.isArchived) return false;
      }

      // 2. 置顶过滤：如果要求 onlyPinned
      if ($filter.onlyPinned && !memo.isPinned) {
        return false;
      }

      // 3. 标签过滤：支持多级标签。例如筛选 "读书"，则标签为 "读书" 或以 "读书/" 开头的笔记都符合
      if ($filter.tag) {
        const targetTag = $filter.tag;
        const hasTag = memo.tags.some(tag => 
          tag === targetTag || tag.startsWith(`${targetTag}/`)
        );
        if (!hasTag) return false;
      }

      // 4. 搜索框过滤：搜索内容（不区分大小写）
      if ($filter.search) {
        const keyword = $filter.search.toLowerCase().trim();
        const contentMatch = memo.content.toLowerCase().includes(keyword);
        // 也支持直接搜标签名
        const tagMatch = memo.tags.some(tag => tag.toLowerCase().includes(keyword));
        if (!contentMatch && !tagMatch) return false;
      }

      // 5. 时间范围过滤
      if ($filter.dateRange) {
        const memoTime = new Date(memo.createdAt).getTime();
        const startTime = new Date($filter.dateRange.start).getTime();
        const endTime = new Date($filter.dateRange.end).getTime();
        if (memoTime < startTime || memoTime > endTime) {
          return false;
        }
      }

      // 6. 特殊类型过滤 (图片、音频、链接、无标签)
      if ($filter.specialFilter) {
        if ($filter.specialFilter === 'has_image') {
          const hasImg = memo.resources?.some(r => r.mimeType.startsWith('image/')) || false;
          if (!hasImg) return false;
        } else if ($filter.specialFilter === 'has_audio') {
          const hasAud = memo.resources?.some(r => r.mimeType.startsWith('audio/')) || false;
          if (!hasAud) return false;
        } else if ($filter.specialFilter === 'has_link') {
          const hasLink = /https?:\/\/[^\s]+/.test(memo.content);
          if (!hasLink) return false;
        } else if ($filter.specialFilter === 'no_tag') {
          if (memo.tags && memo.tags.length > 0) return false;
        }
      }

      return true;
    });
  }
);
