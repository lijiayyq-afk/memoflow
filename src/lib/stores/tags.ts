/* tags.ts - 标签管理状态 Store，支持树状结构构建、批量重命名、删除和输入联想 */

import { writable, derived } from 'svelte/store';
import { apiFetch } from '$lib/api';
import type { TagNode } from '$lib/types';

interface TagsState {
  tagsMap: Record<string, number>; // 标签路径 -> 笔记数的映射，如 {"读书": 2, "读书/设计": 1}
  loading: boolean;
  error: string | null;
}

const initialState: TagsState = {
  tagsMap: {},
  loading: false,
  error: null
};

// 辅助函数：将一维标签 Map 构建成树状结构
export function buildTagTree(tagsMap: Record<string, number>): TagNode[] {
  const root: TagNode[] = [];

  // 遍历所有标签路径
  for (const [path, count] of Object.entries(tagsMap)) {
    const parts = path.split('/');
    let currentLevel = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      // 寻找当前层级是否已存在该节点
      let node = currentLevel.find(n => n.name === part);

      if (!node) {
        node = {
          name: part,
          path: currentPath,
          children: [],
          memoCount: 0
        };
        currentLevel.push(node);
      }

      // 如果是叶子节点，或者虽然是中间路径但该路径在 map 中有值，加上它的计数
      // flomo 规则中，父节点数应包含子节点数。我们在这里简单地为路径上所有经过的节点累加数量
      node.memoCount += count;
      currentLevel = node.children;
    }
  }

  // 递归排序子节点，使得界面展示按字母或拼音有序
  const sortTree = (nodes: TagNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    nodes.forEach(n => {
      if (n.children.length > 0) {
        sortTree(n.children);
      }
    });
  };

  sortTree(root);
  return root;
}

function createTagsStore() {
  const { subscribe, set, update } = writable<TagsState>(initialState);

  // 1. 从后端拉取标签列表
  async function fetchTags() {
    update(s => ({ ...s, loading: true, error: null }));
    try {
      const tagsMap = await apiFetch<Record<string, number>>('/tags');
      set({ tagsMap, loading: false, error: null });
    } catch (err: any) {
      update(s => ({ ...s, loading: false, error: err.message || '获取标签失败' }));
    }
  }

  // 2. 批量重命名标签（会影响到后端所有包含该标签的笔记）
  async function renameTag(oldPath: string, newPath: string) {
    update(s => ({ ...s, loading: true }));
    try {
      await apiFetch('/tags/rename', {
        method: 'POST',
        body: JSON.stringify({ oldPath, newPath })
      });
      
      // 更新成功后，由于笔记内容中的标签文字也需要改变，最好通知 memos store 重新拉取
      // 这里更新本地状态作为回执
      update(s => {
        const nextMap = { ...s.tagsMap };
        const count = nextMap[oldPath] || 0;
        delete nextMap[oldPath];
        if (count > 0) {
          nextMap[newPath] = (nextMap[newPath] || 0) + count;
        }
        
        // 还要处理子标签的自动重命名，例如 oldPath = "读书"，newPath = "学习"
        // 则 "读书/设计" 应变为 "学习/设计"
        for (const [key, val] of Object.entries(nextMap)) {
          if (key.startsWith(`${oldPath}/`)) {
            const suffix = key.slice(oldPath.length);
            const newKey = `${newPath}${suffix}`;
            delete nextMap[key];
            nextMap[newKey] = val;
          }
        }

        return { ...s, tagsMap: nextMap, loading: false };
      });
    } catch (err: any) {
      update(s => ({ ...s, loading: false, error: err.message || '重命名标签失败' }));
      throw err;
    }
  }

  // 3. 删除标签（移除所有笔记中的该标签）
  async function deleteTag(path: string) {
    update(s => ({ ...s, loading: true }));
    try {
      await apiFetch('/tags', {
        method: 'DELETE',
        body: JSON.stringify({ path })
      });

      update(s => {
        const nextMap = { ...s.tagsMap };
        delete nextMap[path];
        
        // 级联删除子标签
        for (const key of Object.keys(nextMap)) {
          if (key.startsWith(`${path}/`)) {
            delete nextMap[key];
          }
        }

        return { ...s, tagsMap: nextMap, loading: false };
      });
    } catch (err: any) {
      update(s => ({ ...s, loading: false, error: err.message || '删除标签失败' }));
      throw err;
    }
  }

  // 由 memos store 调用：在拉取完笔记后批量更新前端标签映射
  function setTagsFromMap(tagsMap: Record<string, number>) {
    update(s => ({ ...s, tagsMap, error: null }));
  }

  return {
    subscribe,
    fetchTags,
    renameTag,
    deleteTag,
    setTagsFromMap
  };
}

export const tags = createTagsStore();

// 派生 Store 1：一维标签路径列表 (用于联想和普通遍历)
export const tagsList = derived(tags, ($tags) => {
  return Object.keys($tags.tagsMap).sort((a, b) => a.localeCompare(b, 'zh'));
});

// 派生 Store 2：树状结构的标签 (用于侧边栏渲染)
export const tagsTree = derived(tags, ($tags) => {
  return buildTagTree($tags.tagsMap);
});

// 派生方法/功能：标签智能联想
// 在编辑器中打出 # 时，基于输入查询相关标签列表
export function suggestTags(input: string, list: string[]): string[] {
  if (!input) return list.slice(0, 10); // 默认返回前10个
  const query = input.toLowerCase().trim();
  return list.filter(tag => tag.toLowerCase().includes(query));
}
