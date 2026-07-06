/* index.ts - 全局 TypeScript 类型定义 */

// 用户信息
export interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  createdAt: string;
}

// 资源文件 (R2 存储的图片、视频、附件等)
export interface Resource {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
  file_key?: string;
  fileKey?: string;
}

// 笔记
export interface Memo {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  isArchived: boolean;
  tags: string[];
  resources?: Resource[];
}

// 笔记过滤条件
export interface MemoFilter {
  tag: string | null;      // 按标签筛选
  search: string | null;   // 搜索关键字
  onlyPinned: boolean;     // 仅看置顶
  onlyArchived: boolean;   // 仅看归档
  dateRange: { start: string; end: string } | null; // 时间范围
  specialFilter: 'has_image' | 'has_audio' | 'has_link' | 'no_tag' | null; // 特殊过滤条件
}

// 树状标签节点
export interface TagNode {
  name: string;            // 当前节点的相对名字，如 "设计"
  path: string;            // 完整路径，如 "读书笔记/设计"
  children: TagNode[];     // 子标签
  memoCount: number;       // 该标签下的笔记数 (包含子标签)
}
