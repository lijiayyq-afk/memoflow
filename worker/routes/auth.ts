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

  // 1. 写入数据库 (含 display_name)
  await c.env.DB.prepare(
    'INSERT INTO users (id, username, password_hash, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(userId, username, passwordHash, email || null, username, now, now).run();

  // 2. 注册成功后自动签发 JWT 实现自动登录
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const payload = {
    userId: userId,
    username: username,
    exp: exp
  };
  const token = await sign(payload, c.env.JWT_SECRET);

  // 3. 将会话记录至 KV
  await c.env.KV.put(`session:${userId}`, token, {
    expirationTtl: 7 * 24 * 60 * 60
  });

  return c.json({
    success: true,
    message: 'User registered successfully',
    token,
    user: { id: userId, username }
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

  // 登录成功，生成 JWT Token (7天预设过期)
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const payload = {
    userId: user.id,
    username: user.username,
    exp: exp
  };
  const token = await sign(payload, c.env.JWT_SECRET);

  // 记录会话在 KV 中，设置过期时间
  await c.env.KV.put(`session:${user.id}`, token, {
    expirationTtl: 7 * 24 * 60 * 60
  });

  // 扁平返回结构，无缝对接前端解构
  return c.json({
    success: true,
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      username: user.username
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
