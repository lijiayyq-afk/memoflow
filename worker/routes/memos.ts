import { Hono } from 'hono';
import { Env, ContextVariables } from '../types';

export const memosRouter = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

// 正则解析文本中的标签。例如 #标签 或者 #标签/子标签
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

// 辅助函数：根据层级标签名（例如 “生活/日常”）自动创建层级标签，并返回末端标签的 ID
async function getOrCreateTagChain(db: D1Database, userId: string, tagPath: string): Promise<string> {
  const parts = tagPath.split('/').map(p => p.trim()).filter(Boolean);
  let parentId: string | null = null;
  let lastTagId = '';

  const now = Date.now();

  for (const part of parts) {
    // 查找当前层级是否存在对应的标签
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
      // 不存在，创建新标签
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
  // 1. 提取标签
  const tagPaths = extractTags(content);
  
  // 2. 清理旧关联
  await db.prepare('DELETE FROM memo_tags WHERE memo_id = ?').bind(memoId).run();

  if (tagPaths.length === 0) return;

  // 3. 对每个提取出的标签，获取或创建其标签链，并在 memo_tags 建立联系
  for (const path of tagPaths) {
    const tagId = await getOrCreateTagChain(db, userId, path);
    await db.prepare(
      'INSERT OR IGNORE INTO memo_tags (memo_id, tag_id) VALUES (?, ?)'
    ).bind(memoId, tagId).run();
  }
}

// 1. 获取笔记列表 (支持分页，过滤，归档状态)
memosRouter.get('/', async (c) => {
  const user = c.get('user')!;
  const isArchived = c.req.query('is_archived') === 'true' ? 1 : 0;
  const tagFilter = c.req.query('tag'); // 标签过滤
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

  // 排序：置顶在前，其次按创建时间降序
  sql += ' ORDER BY m.is_pinned DESC, m.created_at DESC LIMIT ? OFFSET ?';
  bindings.push(limit, offset);

  const { results } = await c.env.DB.prepare(sql).bind(...bindings).all<any>();

  // 格式化输出
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

  // 使用 D1 Batch 确保原子性
  const batchStatements = [
    c.env.DB.prepare(
      'INSERT INTO memos (id, user_id, content, is_archived, is_pinned, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?, ?)'
    ).bind(memoId, user.userId, content, pinnedVal, now, now)
  ];

  // 关联预先上传的资源文件
  if (Array.isArray(resourceIds) && resourceIds.length > 0) {
    for (const rId of resourceIds) {
      batchStatements.push(
        c.env.DB.prepare('UPDATE resources SET memo_id = ? WHERE id = ? AND user_id = ?').bind(memoId, rId, user.userId)
      );
    }
  }

  await c.env.DB.batch(batchStatements);

  // 解析并绑定标签
  await bindTagsToMemo(c.env.DB, user.userId, memoId, content);

  // 获取创建后的笔记数据
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

// 3. 更新笔记 (包括置顶/内容/归档)
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

  // 如果内容变动，重新提取绑定标签
  if (content !== undefined) {
    await bindTagsToMemo(c.env.DB, user.userId, memoId, content);
  }

  return c.json({ success: true, message: 'Memo updated successfully' });
});

// 4. 彻底删除笔记
memosRouter.delete('/:id', async (c) => {
  const user = c.get('user')!;
  const memoId = c.req.param('id');

  // 查询笔记绑定的 R2 资源，需要先将 R2 中的文件清理掉
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
  
  if (!c.env.BUCKET) {
    return c.json({ success: false, message: '图片存储服务未启用，请在 Cloudflare Dashboard 中开通并绑定 R2' }, 400);
  }

  const formData = await c.req.parseBody();
  const file = formData.file;

  if (!file || !(file instanceof File)) {
    return c.json({ success: false, message: 'File is required' }, 400);
  }

  const fileId = crypto.randomUUID();
  const extension = file.name.split('.').pop();
  const fileKey = `${user.userId}/${fileId}${extension ? '.' + extension : ''}`;
  const fileBuffer = await file.arrayBuffer();

  // 1. 存入 R2 Bucket
  await c.env.BUCKET.put(fileKey, fileBuffer, {
    httpMetadata: {
      contentType: file.type,
    }
  });

  // 2. 存入 D1 数据库
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
  
  if (!c.env.BUCKET) {
    return c.json({ success: false, message: '图片存储服务未启用' }, 400);
  }

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
