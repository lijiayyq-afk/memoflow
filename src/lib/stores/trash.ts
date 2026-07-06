/* trash.ts - 回收站管理 Store，用于前端暂存已删除笔记，支持一键清空和恢复 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { Memo } from '$lib/types';
import { memos } from './memos';

interface TrashState {
  items: Memo[];
}

const initialState: TrashState = {
  items: []
};

function createTrashStore() {
  const { subscribe, set, update } = writable<TrashState>(initialState);

  // 从本地存储初始化
  function init() {
    if (!browser) return;
    try {
      const stored = localStorage.getItem('memoflow_trash');
      if (stored) {
        set({ items: JSON.parse(stored) });
      }
    } catch (e) {
      console.error('初始化回收站失败:', e);
    }
  }

  // 保存到本地存储
  function save(items: Memo[]) {
    if (!browser) return;
    try {
      localStorage.setItem('memoflow_trash', JSON.stringify(items));
    } catch (e) {
      console.error('保存回收站失败:', e);
    }
  }

  // 1. 移入回收站 (在 memos.ts 中的 deleteMemo 中触发)
  function moveToTrash(memo: Memo) {
    update(s => {
      // 避免重复添加
      if (s.items.some(item => item.id === memo.id)) return s;
      const nextItems = [memo, ...s.items];
      save(nextItems);
      return { items: nextItems };
    });
  }

  // 2. 恢复笔记 (在后端重新创建，然后从回收站移除)
  async function restoreMemo(id: string) {
    let memoToRestore: Memo | undefined;
    
    update(s => {
      memoToRestore = s.items.find(item => item.id === id);
      return s;
    });

    if (!memoToRestore) return;

    try {
      // 提取附件ID
      const resourceIds = memoToRestore.resources?.map(r => r.id) || [];
      // 重新在后端创建该笔记
      await memos.createMemo(memoToRestore.content, resourceIds);
      
      // 重新创建成功后，从回收站移除
      update(s => {
        const nextItems = s.items.filter(item => item.id !== id);
        save(nextItems);
        return { items: nextItems };
      });
    } catch (err) {
      console.error('恢复笔记失败:', err);
      throw err;
    }
  }

  // 3. 彻底删除单个笔记 (仅在前端移除，因为后端在放入回收站时已经真正硬删除了)
  function deletePermanently(id: string) {
    update(s => {
      const nextItems = s.items.filter(item => item.id !== id);
      save(nextItems);
      return { items: nextItems };
    });
  }

  // 4. 一键清空回收站
  function clearAll() {
    update(() => {
      save([]);
      return { items: [] };
    });
  }

  return {
    subscribe,
    init,
    moveToTrash,
    restoreMemo,
    deletePermanently,
    clearAll
  };
}

export const trash = createTrashStore();
