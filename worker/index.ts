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
  origin: '*', // 生产环境下建议设定为实际的前端 URL
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
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as unknown as UserPayload;
    
    // 校验 KV 中是否存在该 token 的有效会话，若不存在则提示已下线
    const storedToken = await c.env.KV.get(`session:${payload.userId}`);
    if (storedToken !== token) {
      return c.json({ success: false, message: 'Unauthorized: Session expired or logged in elsewhere' }, 401);
    }
    
    c.set('user', payload);
    await next();
  } catch (err: any) {
    console.error('JWT verification error:', err);
    return c.json({ success: false, message: 'Unauthorized: Invalid token', error: err?.message || String(err) }, 401);
  }
});

// 5. 挂载子路由
app.route('/api/auth', authRouter);
app.route('/api/memos', memosRouter);
app.route('/api/tags', tagsRouter);

export default app;
