-- MemoFlow - Cloudflare D1 (SQLite) Schema v1.0
PRAGMA foreign_keys = ON;

-- 1. 用户表
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email         TEXT,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. 笔记主表
CREATE TABLE memos (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,                                       -- 笔记富文本/Markdown内容
  is_archived   INTEGER CHECK(is_archived IN (0, 1)) DEFAULT 0,      -- 是否归档 (0:否, 1:是)
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT                                                 -- 软删除时间戳，为 NULL 表示未删除
);

-- 3. 部分索引（Partial Index）优化查询性能
CREATE INDEX idx_memos_user_active  ON memos(user_id, created_at DESC) WHERE deleted_at IS NULL AND is_archived = 0;
CREATE INDEX idx_memos_user_archive ON memos(user_id, created_at DESC) WHERE deleted_at IS NULL AND is_archived = 1;
CREATE INDEX idx_memos_user_trash   ON memos(user_id, deleted_at DESC) WHERE deleted_at IS NOT NULL;

-- 4. 标签表
CREATE TABLE tags (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,                                       -- 标签名 (不含 #)
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_tags_user ON tags(user_id);

-- 5. 笔记-标签关联表 (多对多)
CREATE TABLE memo_tags (
  memo_id       TEXT NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  tag_id        TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (memo_id, tag_id)
);

CREATE INDEX idx_memo_tags_tag ON memo_tags(tag_id);

-- 6. 附件表
CREATE TABLE attachments (
  id            TEXT PRIMARY KEY,
  memo_id       TEXT REFERENCES memos(id) ON DELETE CASCADE,         -- 关联的笔记，可空
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,-- 上传用户
  file_name     TEXT NOT NULL,                                       -- 原始文件名
  file_type     TEXT NOT NULL,                                       -- MIME 类型
  file_size     INTEGER NOT NULL,                                    -- 文件大小 (字节)
  storage_path  TEXT NOT NULL UNIQUE,                                -- R2 存储路径
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_attachments_memo ON attachments(memo_id);
CREATE INDEX idx_attachments_user ON attachments(user_id);

-- 7. 预置种子数据 (Seed Data)
-- 密码哈希对应 123456 (使用 bcrypt 哈希)
INSERT INTO users (id, username, password_hash, display_name) VALUES
  ('usr-demo', 'demo', '$2a$10$7zB35sF1Y5Rj5Z2rP0pWEOe21G57M6k3p5F/rI4J2yW9nB1V1C6d.', '测试用户');

INSERT INTO tags (id, user_id, name) VALUES
  ('tag-work',  'usr-demo', '工作'),
  ('tag-life',  'usr-demo', '生活'),
  ('tag-study', 'usr-demo', '学习');

INSERT INTO memos (id, user_id, content, is_archived) VALUES
  ('memo-welcome', 'usr-demo', '<p>欢迎使用 <strong>MemoFlow</strong>！这是一个极简的 flomo 开源复刻版笔记应用。支持富文本、标签管理和附件上传。开始记录你的想法吧！#学习 #工作</p>', 0);

INSERT INTO memo_tags (memo_id, tag_id) VALUES
  ('memo-welcome', 'tag-study'),
  ('memo-welcome', 'tag-work');
