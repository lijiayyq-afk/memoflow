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
