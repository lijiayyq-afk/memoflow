# Cloudflare Worker 后端 API 骨架与路由实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `worker` 目录下使用 Hono.js 和 TypeScript 编写 MemoFlow 后端 API 服务，实现与 D1 (数据库)、R2 (对象存储)、KV (会话缓存) 的真实交互逻辑，并完成用户认证、笔记增删改查（含标签自动提取）、标签树管理等功能。

**Architecture:** 
后端服务独立位于 `worker` 目录，作为一个独立的 Cloudflare Worker 项目。采用模块化路由架构，入口 `index.ts` 负责 CORS、JWT 验证中间件和全局错误处理；路由细分为 `auth` (认证)、`memos` (笔记管理及文件上传)、`tags` (标签树管理)。数据存储采用 SQLite (D1)、缓存与会话状态采用 KV、文件存储采用 R2。

**Tech Stack:** Hono.js, TypeScript, Cloudflare D1 (SQLite), Cloudflare R2, Cloudflare KV, wrangler (Local Development & Deployment)

---

### Task 1: 初始化 Worker 目录结构与配置

**Files:**
- Create: `worker/package.json`
- Create: `worker/tsconfig.json`
- Create: `worker/wrangler.toml`
- Create: `worker/schema.sql`

- [ ] **Step 1: 创建 worker/package.json**

```json
{
  "name": "memoflow-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250109.0",
    "typescript": "^5.3.3",
    "wrangler": "^3.100.0"
  },
  "dependencies": {
    "hono": "^4.6.0"
  }
}
```

- [ ] **Step 2: 创建 worker/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types"]
  }
}
```

- [ ] **Step 3: 创建 worker/wrangler.toml**

```toml
name = "memoflow-backend"
main = "index.ts"
compatibility_date = "2024-01-01"

[vars]
JWT_SECRET = "memoflow-super-secret-key"

[[kv_namespaces]]
binding = "KV"
id = "memoflow_kv_placeholder"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "memoflow-bucket-placeholder"

[[d1_databases]]
binding = "DB"
database_name = "memoflow-db"
database_id = "memoflow_db_placeholder"
```

- [ ] **Step 4: 创建数据库初始化 SQL 文件 `worker/schema.sql`**

```sql
-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 笔记表
CREATE TABLE IF NOT EXISTS memos (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    is_archived INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 标签表 (支持层级结构)
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    parent_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES tags(id) ON DELETE SET NULL,
    UNIQUE(user_id, name, parent_id)
);

-- 笔记与标签的关联表
CREATE TABLE IF NOT EXISTS memo_tags (
    memo_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (memo_id, tag_id),
    FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- 附件资源表 (用于 R2)
CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    memo_id TEXT,
    filename TEXT NOT NULL,
    file_key TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE SET NULL
);
```

- [ ] **Step 5: 安装依赖**

在 `E:\ai_code\memoflow\worker` 目录下运行 `npm install`。

---

### Task 2: 编写全局入口与中间件

**Files:**
- Create: `worker/types.ts`
- Create: `worker/index.ts`

- [ ] **Step 1: 创建全局类型声明文件 `worker/types.ts`**

```typescript
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  BUCKET: R2Bucket;
  JWT_SECRET: string;
}

export interface UserPayload {
  userId: string;
  username: string;
  exp: number;
}

// Hono 环境变量 Context 类型定义
export type ContextVariables = {
  user?: UserPayload;
};
```

- [ ] **Step 2: 创建 `worker/index.ts` 入口文件，实现 CORS、全局错误处理和 JWT 验证中间件**

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verify } from 'hono/jwt';
import { Env, ContextVariables, UserPayload } from './types';
import { authRouter } from './routes/auth';
import { memosRouter } from './routes/memos';
import { tagsRouter } from './routes/tags';

const app = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

// 1. 设置跨域 CORS
app.use('*', cors({
  origin: '*', // 生产环境下可配置为前端实际域名
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

// 2. 全局错误处理
app.onError((err, c) => {
  console.error('Global Error Handler:', err);
  return c.json({
    success: false,
    message: err.message || 'Internal Server Error',
  }, 500);
});

// 3. 全局 404 处理
app.notFound((c) => {
  return c.json({
    success: false,
    message: 'Route Not Found',
  }, 404);
});

// 4. JWT 鉴权校验中间件 (排除登录与注册接口)
app.use('/api/*', async (c, next) => {
  const path = c.req.path;
  if (path === '/api/auth/register' || path === '/api/auth/login') {
    await next();
    return;
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, message: 'Unauthorized: Missing or invalid token format' }, 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = await verify(token, c.env.JWT_SECRET) as unknown as UserPayload;
    
    // 校验 KV 中是否存在该 token 的有效会话，若不存在则提示已下线
    const storedToken = await c.env.KV.get(`session:${payload.userId}`);
    if (storedToken !== token) {
      return c.json({ success: false, message: 'Unauthorized: Session expired or logged in elsewhere' }, 401);
    }
    
    c.set('user', payload);
    await next();
  } catch (err) {
    return c.json({ success: false, message: 'Unauthorized: Invalid token' }, 401);
  }
});

// 5. 挂载子路由
app.route('/api/auth', authRouter);
app.route('/api/memos', memosRouter);
app.route('/api/tags', tagsRouter);

export default app;
```

---

### Task 3: 编写用户注册与登录 API

**Files:**
- Create: `worker/routes/auth.ts`

- [ ] **Step 1: 创建 `worker/routes/auth.ts` 并实现注册、登录逻辑**

```typescript
import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { Env, ContextVariables } from '../types';

export const authRouter = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

// 辅助函数：使用 SHA-256 计算哈希值
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'memoflow-salt-string');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 1. 注册 API
authRouter.post('/register', async (c) => {
  const { username, password, email } = await c.req.json();

  if (!username || !password) {
    return c.json({ success: false, message: 'Username and password are required' }, 400);
  }

  // 检查用户名是否已存在
  const existingUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE username = ?'
  ).bind(username).first();

  if (existingUser) {
    return c.json({ success: false, message: 'Username already exists' }, 409);
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const now = Date.now();

  await c.env.DB.prepare(
    'INSERT INTO users (id, username, password_hash, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(userId, username, passwordHash, email || null, now, now).run();

  return c.json({
    success: true,
    message: 'User registered successfully',
    data: { userId, username }
  }, 201);
});

// 2. 登录 API
authRouter.post('/login', async (c) => {
  const { username, password } = await c.req.json();

  if (!username || !password) {
    return c.json({ success: false, message: 'Username and password are required' }, 400);
  }

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE username = ?'
  ).bind(username).first<{ id: string; username: string; password_hash: string }>();

  if (!user) {
    return c.json({ success: false, message: 'Invalid username or password' }, 401);
  }

  const passwordHash = await hashPassword(password);
  if (user.password_hash !== passwordHash) {
    return c.json({ success: false, message: 'Invalid username or password' }, 401);
  }

  // 登录成功，生成 JWT Token (7天过期)
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const payload = {
    userId: user.id,
    username: user.username,
    exp: exp
  };
  const token = await sign(payload, c.env.JWT_SECRET);

  // 记录会话在 KV 中，Key 为 `session:<userId>`，设置过期时间
  await c.env.KV.put(`session:${user.id}`, token, {
    expirationTtl: 7 * 24 * 60 * 60
  });

  return c.json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      user: {
        id: user.id,
        username: user.username
      }
    }
  });
});

// 3. 登出 API
authRouter.post('/logout', async (c) => {
  const user = c.get('user');
  if (user) {
    await c.env.KV.delete(`session:${user.userId}`);
  }
  return c.json({ success: true, message: 'Logout successful' });
});
```

---

### Task 4: 编写笔记增删改查路由及标签自动绑定

**Files:**
- Create: `worker/routes/memos.ts`

- [ ] **Step 1: 创建 `worker/routes/memos.ts` 并实现笔记列表、增、改、删及资源上传逻辑**

```typescript
import { Hono } from 'hono';
import { Env, ContextVariables } from '../types';

export const memosRouter = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

// 正则解析文本中的标签
function extractTags(content: string): string[] {
  const regex = /#([^\s#]+)/g;
  const tags: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const tagName = match[1].trim();
    if (tagName && !tags.includes(tagName)) {
      tags.push(tagName);
    }
  }
  return tags;
}

// 辅助函数：自动创建层级标签，并返回末端标签的 ID
async function getOrCreateTagChain(db: D1Database, userId: string, tagPath: string): Promise<string> {
  const parts = tagPath.split('/').map(p => p.trim()).filter(Boolean);
  let parentId: string | null = null;
  let lastTagId = '';

  const now = Date.now();

  for (const part of parts) {
    let sql = 'SELECT id FROM tags WHERE user_id = ? AND name = ?';
    let query = db.prepare(sql).bind(userId, part);
    
    if (parentId) {
      sql += ' AND parent_id = ?';
      query = db.prepare(sql).bind(userId, part, parentId);
    } else {
      sql += ' AND parent_id IS NULL';
      query = db.prepare(sql).bind(userId, part);
    }

    const row = await query.first<{ id: string }>();

    if (row) {
      parentId = row.id;
      lastTagId = row.id;
    } else {
      const newTagId = crypto.randomUUID();
      await db.prepare(
        'INSERT INTO tags (id, user_id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(newTagId, userId, part, parentId, now, now).run();
      
      parentId = newTagId;
      lastTagId = newTagId;
    }
  }

  return lastTagId;
}

// 绑定标签到笔记中
async function bindTagsToMemo(db: D1Database, userId: string, memoId: string, content: string) {
  const tagPaths = extractTags(content);
  await db.prepare('DELETE FROM memo_tags WHERE memo_id = ?').bind(memoId).run();

  if (tagPaths.length === 0) return;

  for (const path of tagPaths) {
    const tagId = await getOrCreateTagChain(db, userId, path);
    await db.prepare(
      'INSERT OR IGNORE INTO memo_tags (memo_id, tag_id) VALUES (?, ?)'
    ).bind(memoId, tagId).run();
  }
}

// 1. 获取笔记列表
memosRouter.get('/', async (c) => {
  const user = c.get('user')!;
  const isArchived = c.req.query('is_archived') === 'true' ? 1 : 0;
  const tagFilter = c.req.query('tag');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');

  let sql = `
    SELECT m.*, 
    (
      SELECT json_group_array(json_object('id', t.id, 'name', t.name, 'parent_id', t.parent_id))
      FROM tags t
      JOIN memo_tags mt ON mt.tag_id = t.id
      WHERE mt.memo_id = m.id
    ) as tags,
    (
      SELECT json_group_array(json_object('id', r.id, 'filename', r.filename, 'file_key', r.file_key, 'mime_type', r.mime_type, 'size', r.size))
      FROM resources r
      WHERE r.memo_id = m.id
    ) as resources
    FROM memos m
    WHERE m.user_id = ? AND m.is_archived = ?
  `;
  const bindings: any[] = [user.userId, isArchived];

  if (tagFilter) {
    const matchedTags = await c.env.DB.prepare(
      'SELECT id FROM tags WHERE user_id = ? AND name = ?'
    ).bind(user.userId, tagFilter).all<{ id: string }>();

    if (matchedTags.results.length === 0) {
      return c.json({ success: true, data: [], total: 0 });
    }
    const tagIds = matchedTags.results.map(t => t.id);

    sql += ` AND m.id IN (SELECT memo_id FROM memo_tags WHERE tag_id IN (${tagIds.map(() => '?').join(',')}))`;
    bindings.push(...tagIds);
  }

  sql += ' ORDER BY m.is_pinned DESC, m.created_at DESC LIMIT ? OFFSET ?';
  bindings.push(limit, offset);

  const { results } = await c.env.DB.prepare(sql).bind(...bindings).all<any>();

  const data = results.map(row => ({
    ...row,
    is_archived: row.is_archived === 1,
    is_pinned: row.is_pinned === 1,
    tags: JSON.parse(row.tags || '[]'),
    resources: JSON.parse(row.resources || '[]')
  }));

  return c.json({ success: true, data });
});

// 2. 创建笔记
memosRouter.post('/', async (c) => {
  const user = c.get('user')!;
  const { content, is_pinned, resourceIds } = await c.req.json();

  if (!content || !content.trim()) {
    return c.json({ success: false, message: 'Content cannot be empty' }, 400);
  }

  const memoId = crypto.randomUUID();
  const now = Date.now();
  const pinnedVal = is_pinned ? 1 : 0;

  const batchStatements = [
    c.env.DB.prepare(
      'INSERT INTO memos (id, user_id, content, is_archived, is_pinned, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?, ?)'
    ).bind(memoId, user.userId, content, pinnedVal, now, now)
  ];

  if (Array.isArray(resourceIds) && resourceIds.length > 0) {
    for (const rId of resourceIds) {
      batchStatements.push(
        c.env.DB.prepare('UPDATE resources SET memo_id = ? WHERE id = ? AND user_id = ?').bind(memoId, rId, user.userId)
      );
    }
  }

  await c.env.DB.batch(batchStatements);
  await bindTagsToMemo(c.env.DB, user.userId, memoId, content);

  const memoData = await c.env.DB.prepare(
    `SELECT m.*, 
     (SELECT json_group_array(json_object('id', t.id, 'name', t.name)) FROM tags t JOIN memo_tags mt ON mt.tag_id = t.id WHERE mt.memo_id = m.id) as tags,
     (SELECT json_group_array(json_object('id', r.id, 'filename', r.filename, 'file_key', r.file_key)) FROM resources r WHERE r.memo_id = m.id) as resources
     FROM memos m WHERE m.id = ?`
  ).bind(memoId).first<any>();

  return c.json({
    success: true,
    data: {
      ...memoData,
      is_archived: memoData.is_archived === 1,
      is_pinned: memoData.is_pinned === 1,
      tags: JSON.parse(memoData.tags || '[]'),
      resources: JSON.parse(memoData.resources || '[]')
    }
  }, 201);
});

// 3. 更新笔记
memosRouter.put('/:id', async (c) => {
  const user = c.get('user')!;
  const memoId = c.req.param('id');
  const { content, is_pinned, is_archived } = await c.req.json();

  const existing = await c.env.DB.prepare(
    'SELECT id FROM memos WHERE id = ? AND user_id = ?'
  ).bind(memoId, user.userId).first();

  if (!existing) {
    return c.json({ success: false, message: 'Memo not found' }, 404);
  }

  const updates: string[] = [];
  const bindings: any[] = [];

  if (content !== undefined) {
    updates.push('content = ?');
    bindings.push(content);
  }
  if (is_pinned !== undefined) {
    updates.push('is_pinned = ?');
    bindings.push(is_pinned ? 1 : 0);
  }
  if (is_archived !== undefined) {
    updates.push('is_archived = ?');
    bindings.push(is_archived ? 1 : 0);
  }

  if (updates.length > 0) {
    updates.push('updated_at = ?');
    bindings.push(Date.now());

    const sql = `UPDATE memos SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;
    bindings.push(memoId, user.userId);
    await c.env.DB.prepare(sql).bind(...bindings).run();
  }

  if (content !== undefined) {
    await bindTagsToMemo(c.env.DB, user.userId, memoId, content);
  }

  return c.json({ success: true, message: 'Memo updated successfully' });
});

// 4. 彻底删除笔记
memosRouter.delete('/:id', async (c) => {
  const user = c.get('user')!;
  const memoId = c.req.param('id');

  const resources = await c.env.DB.prepare(
    'SELECT file_key FROM resources WHERE memo_id = ? AND user_id = ?'
  ).bind(memoId, user.userId).all<{ file_key: string }>();

  for (const res of resources.results) {
    try {
      await c.env.BUCKET.delete(res.file_key);
    } catch (e) {
      console.error(`Failed to delete object from R2: ${res.file_key}`, e);
    }
  }

  const result = await c.env.DB.prepare(
    'DELETE FROM memos WHERE id = ? AND user_id = ?'
  ).bind(memoId, user.userId).run();

  if (result.meta.changes === 0) {
    return c.json({ success: false, message: 'Memo not found or unauthorized' }, 404);
  }

  return c.json({ success: true, message: 'Memo permanently deleted' });
});

// 5. R2 附件文件上传 API
memosRouter.post('/upload', async (c) => {
  const user = c.get('user')!;
  const formData = await c.req.parseBody();
  const file = formData.file;

  if (!file || !(file instanceof File)) {
    return c.json({ success: false, message: 'File is required' }, 400);
  }

  const fileId = crypto.randomUUID();
  const extension = file.name.split('.').pop();
  const fileKey = `${user.userId}/${fileId}${extension ? '.' + extension : ''}`;
  const fileBuffer = await file.arrayBuffer();

  await c.env.BUCKET.put(fileKey, fileBuffer, {
    httpMetadata: {
      contentType: file.type,
    }
  });

  await c.env.DB.prepare(
    'INSERT INTO resources (id, user_id, memo_id, filename, file_key, mime_type, size, created_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)'
  ).bind(fileId, user.userId, file.name, fileKey, file.type, file.size, Date.now()).run();

  return c.json({
    success: true,
    data: {
      id: fileId,
      filename: file.name,
      file_key: fileKey,
      mime_type: file.type,
      size: file.size
    }
  }, 201);
});

// 6. R2 附件下载
memosRouter.get('/resources/:key{.+}', async (c) => {
  const key = c.req.param('key');
  const object = await c.env.BUCKET.get(key);

  if (!object) {
    return c.json({ success: false, message: 'File not found' }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);

  return new Response(object.body, {
    headers,
  });
});
```

---

### Task 5: 编写标签树管理 API (获取、重命名、合并、删除)

**Files:**
- Create: `worker/routes/tags.ts`

- [ ] **Step 1: 创建 `worker/routes/tags.ts` 并实现标签管理路由**

```typescript
import { Hono } from 'hono';
import { Env, ContextVariables } from '../types';

export const tagsRouter = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

interface TagNode {
  id: string;
  name: string;
  parent_id: string | null;
  children?: TagNode[];
}

// 1. 获取标签树
tagsRouter.get('/', async (c) => {
  const user = c.get('user')!;

  const { results } = await c.env.DB.prepare(
    'SELECT id, name, parent_id FROM tags WHERE user_id = ?'
  ).bind(user.userId).all<TagNode>();

  const tagMap = new Map<string, TagNode>();
  const tree: TagNode[] = [];

  for (const tag of results) {
    tagMap.set(tag.id, { ...tag, children: [] });
  }

  for (const tag of results) {
    const node = tagMap.get(tag.id)!;
    if (tag.parent_id) {
      const parentNode = tagMap.get(tag.parent_id);
      if (parentNode) {
        parentNode.children = parentNode.children || [];
        parentNode.children.push(node);
      } else {
        tree.push(node);
      }
    } else {
      tree.push(node);
    }
  }

  return c.json({ success: true, data: tree });
});

// 2. 重命名/调整标签
tagsRouter.put('/:id', async (c) => {
  const user = c.get('user')!;
  const tagId = c.req.param('id');
  const { name, parent_id } = await c.req.json();

  const existing = await c.env.DB.prepare(
    'SELECT id FROM tags WHERE id = ? AND user_id = ?'
  ).bind(tagId, user.userId).first();

  if (!existing) {
    return c.json({ success: false, message: 'Tag not found' }, 404);
  }

  const updates: string[] = [];
  const bindings: any[] = [];

  if (name !== undefined) {
    if (!name.trim()) return c.json({ success: false, message: 'Name cannot be empty' }, 400);
    updates.push('name = ?');
    bindings.push(name.trim());
  }

  if (parent_id !== undefined) {
    if (parent_id === tagId) {
      return c.json({ success: false, message: 'Cannot set self as parent' }, 400);
    }
    updates.push('parent_id = ?');
    bindings.push(parent_id);
  }

  if (updates.length > 0) {
    updates.push('updated_at = ?');
    bindings.push(Date.now());

    const sql = `UPDATE tags SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;
    bindings.push(tagId, user.userId);
    await c.env.DB.prepare(sql).bind(...bindings).run();
  }

  return c.json({ success: true, message: 'Tag updated successfully' });
});

// 3. 合并标签
tagsRouter.post('/merge', async (c) => {
  const user = c.get('user')!;
  const { sourceTagId, targetTagId } = await c.req.json();

  if (!sourceTagId || !targetTagId) {
    return c.json({ success: false, message: 'Source and target tag IDs are required' }, 400);
  }

  if (sourceTagId === targetTagId) {
    return c.json({ success: false, message: 'Source and target tags must be different' }, 400);
  }

  const sourceTag = await c.env.DB.prepare(
    'SELECT id FROM tags WHERE id = ? AND user_id = ?'
  ).bind(sourceTagId, user.userId).first();
  
  const targetTag = await c.env.DB.prepare(
    'SELECT id FROM tags WHERE id = ? AND user_id = ?'
  ).bind(targetTagId, user.userId).first();

  if (!sourceTag || !targetTag) {
    return c.json({ success: false, message: 'One or both tags not found' }, 404);
  }

  const memosWithSource = await c.env.DB.prepare(
    'SELECT memo_id FROM memo_tags WHERE tag_id = ?'
  ).bind(sourceTagId).all<{ memo_id: string }>();

  const batchStatements = [];

  for (const item of memosWithSource.results) {
    batchStatements.push(
      c.env.DB.prepare('INSERT OR IGNORE INTO memo_tags (memo_id, tag_id) VALUES (?, ?)')
        .bind(item.memo_id, targetTagId)
    );
  }

  batchStatements.push(
    c.env.DB.prepare('DELETE FROM memo_tags WHERE tag_id = ?').bind(sourceTagId)
  );
  
  batchStatements.push(
    c.env.DB.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').bind(sourceTagId, user.userId)
  );

  await c.env.DB.batch(batchStatements);

  return c.json({ success: true, message: 'Tags merged successfully' });
});

// 4. 删除标签
tagsRouter.delete('/:id', async (c) => {
  const user = c.get('user')!;
  const tagId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    'SELECT id FROM tags WHERE id = ? AND user_id = ?'
  ).bind(tagId, user.userId).first();

  if (!existing) {
    return c.json({ success: false, message: 'Tag not found' }, 404);
  }

  const deleteTagsQuery = `
    WITH RECURSIVE sub_tags(id) AS (
      SELECT id FROM tags WHERE id = ? AND user_id = ?
      UNION ALL
      SELECT t.id FROM tags t JOIN sub_tags st ON t.parent_id = st.id WHERE t.user_id = ?
    )
    DELETE FROM tags WHERE id IN (SELECT id FROM sub_tags)
  `;

  await c.env.DB.prepare(deleteTagsQuery).bind(tagId, user.userId, user.userId).run();

  return c.json({ success: true, message: 'Tag and its sub-tags deleted successfully' });
});
```

---

### Task 6: 部署本地运行测试脚本进行自我校验

为了在不实际部署至 Cloudflare 线上环境的前提下进行测试，我们将配置并启动 `wrangler dev` 的 local 状态，然后通过 Node.js 脚本模拟真实的 API 请求流，包括：注册、登录、发布带标签的笔记、获取笔记、新增带层级标签、获取标签树、重命名、合并、删除。

**Files:**
- Create: `worker/scratch_test.js`

- [ ] **Step 1: 创建 `worker/scratch_test.js` 测试脚本**

```javascript
const http = require('http');

const API_BASE = 'http://127.0.0.1:8787/api';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${path}`;
    const urlObj = new URL(url);
    
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    
    const postData = body ? JSON.stringify(body) : '';
    if (body) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: reqHeaders
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data
          });
        }
      });
    });
    
    req.on('error', (e) => reject(e));
    if (body) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('--- Start Local API Skeleton Tests ---');
  
  const testUser = `test_user_${Math.floor(Math.random() * 1000)}`;
  const testPass = 'Password123!';
  
  console.log('\n[1/6] Registering user...');
  const regRes = await request('POST', '/auth/register', { username: testUser, password: testPass, email: 'test@example.com' });
  console.log('Register Response:', regRes);
  if (regRes.status !== 201) throw new Error('Registration failed');
  
  console.log('\n[2/6] Logging in...');
  const loginRes = await request('POST', '/auth/login', { username: testUser, password: testPass });
  console.log('Login Response:', loginRes);
  if (loginRes.status !== 200) throw new Error('Login failed');
  
  const token = loginRes.body.data.token;
  const authHeader = { 'Authorization': `Bearer ${token}` };
  
  console.log('\n[3/6] Creating memos with nested tags...');
  const memoContent = '今天天气特别好！准备去爬山 #运动/户外运动 还要去跑步 #运动/跑步 简直是完美的一天！';
  const memoRes = await request('POST', '/memos', { content: memoContent, is_pinned: true }, authHeader);
  console.log('Create Memo Response:', memoRes);
  if (memoRes.status !== 201) throw new Error('Memo creation failed');
  
  console.log('\n[4/6] Fetching memos...');
  const getMemosRes = await request('GET', '/memos?is_archived=false', null, authHeader);
  console.log('Fetch Memos Response:', JSON.stringify(getMemosRes.body, null, 2));
  if (getMemosRes.status !== 200) throw new Error('Fetching memos failed');
  
  console.log('\n[5/6] Fetching tags tree...');
  const getTagsRes = await request('GET', '/tags', null, authHeader);
  console.log('Tags Tree Response:', JSON.stringify(getTagsRes.body, null, 2));
  if (getTagsRes.status !== 200) throw new Error('Fetching tags failed');
  
  console.log('\n[6/6] Logging out...');
  const logoutRes = await request('POST', '/auth/logout', null, authHeader);
  console.log('Logout Response:', logoutRes);
  
  console.log('\n--- All Basic Skeleton Tests Passed! ---');
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: 启动本地 wrangler 服务并运行初始化迁移**

本地执行 D1 初始化：
`npx wrangler d1 execute memoflow-db --local --file=schema.sql`

- [ ] **Step 3: 启动 dev 服务并运行测试脚本进行自我校验**
  - 使用 `npx wrangler dev --local` 运行 API。
  - 使用 `node scratch_test.js` 执行接口校验。

---
