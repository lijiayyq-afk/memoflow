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

  // 1. 获取该用户所有标签
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, parent_id FROM tags WHERE user_id = ?'
  ).bind(user.userId).all<TagNode>();

  // 2. 组装为树形结构
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
        // 如果找不到父节点，作为顶级节点兜底
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
    // 避免死循环：parent_id 不能是自己
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

// 3. 合并标签 (POST /api/tags/merge)
tagsRouter.post('/merge', async (c) => {
  const user = c.get('user')!;
  const { sourceTagId, targetTagId } = await c.req.json();

  if (!sourceTagId || !targetTagId) {
    return c.json({ success: false, message: 'Source and target tag IDs are required' }, 400);
  }

  if (sourceTagId === targetTagId) {
    return c.json({ success: false, message: 'Source and target tags must be different' }, 400);
  }

  // 确认两个标签都属于当前用户
  const sourceTag = await c.env.DB.prepare(
    'SELECT id FROM tags WHERE id = ? AND user_id = ?'
  ).bind(sourceTagId, user.userId).first();
  
  const targetTag = await c.env.DB.prepare(
    'SELECT id FROM tags WHERE id = ? AND user_id = ?'
  ).bind(targetTagId, user.userId).first();

  if (!sourceTag || !targetTag) {
    return c.json({ success: false, message: 'One or both tags not found' }, 404);
  }

  // 1. 查找绑定了源标签的笔记 ID 列表
  const memosWithSource = await c.env.DB.prepare(
    'SELECT memo_id FROM memo_tags WHERE tag_id = ?'
  ).bind(sourceTagId).all<{ memo_id: string }>();

  const batchStatements = [];

  for (const item of memosWithSource.results) {
    // 2. 为这些笔记绑定目标标签 (INSERT OR IGNORE 避免重复)
    batchStatements.push(
      c.env.DB.prepare('INSERT OR IGNORE INTO memo_tags (memo_id, tag_id) VALUES (?, ?)')
        .bind(item.memo_id, targetTagId)
    );
  }

  // 3. 删除原有源标签与其笔记关联关系，删除源标签
  batchStatements.push(
    c.env.DB.prepare('DELETE FROM memo_tags WHERE tag_id = ?').bind(sourceTagId)
  );
  
  batchStatements.push(
    c.env.DB.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').bind(sourceTagId, user.userId)
  );

  await c.env.DB.batch(batchStatements);

  return c.json({ success: true, message: 'Tags merged successfully' });
});

// 4. 删除标签 (级联删除子标签，及关联关系)
tagsRouter.delete('/:id', async (c) => {
  const user = c.get('user')!;
  const tagId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    'SELECT id FROM tags WHERE id = ? AND user_id = ?'
  ).bind(tagId, user.userId).first();

  if (!existing) {
    return c.json({ success: false, message: 'Tag not found' }, 404);
  }

  // 利用 SQLite 的 Recursive CTE 级联删除其下的所有子孙标签
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
