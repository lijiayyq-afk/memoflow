<!-- +page.svelte (register) - MemoFlow 注册页面 -->
<script lang="ts">
  import { auth } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let username = $state('');
  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let errorMsg = $state('');
  let loading = $state(false);

  // 如果已经登录，直接跳转到首页
  onMount(() => {
    auth.init();
    const unsubscribe = auth.subscribe(state => {
      if (state.isAuthenticated) {
        goto('/');
      }
    });
    return unsubscribe;
  });

  async function handleRegister(e: SubmitEvent) {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password.trim()) {
      errorMsg = '请完整填写注册信息';
      return;
    }

    if (password !== confirmPassword) {
      errorMsg = '两次输入的密码不一致';
      return;
    }

    loading = true;
    errorMsg = '';
    
    try {
      await auth.register(username.trim(), email.trim(), password);
      goto('/');
    } catch (err: any) {
      errorMsg = err.message || '注册失败，请更换用户名尝试';
    } finally {
      loading = false;
    }
  }
</script>

<div class="register-container">
  <div class="register-card">
    <div class="brand">
      <div class="logo">MF</div>
      <h1>创建新账号</h1>
      <p class="subtitle">开启你的自由卡片笔记之旅</p>
    </div>

    <form class="register-form" onsubmit={handleRegister}>
      {#if errorMsg}
        <div class="error-banner">
          {errorMsg}
        </div>
      {/if}

      <div class="form-group">
        <label for="username">用户名</label>
        <input 
          type="text" 
          id="username" 
          bind:value={username} 
          placeholder="起个好听的名字" 
          required 
          disabled={loading}
        />
      </div>

      <div class="form-group">
        <label for="email">电子邮箱</label>
        <input 
          type="email" 
          id="email" 
          bind:value={email} 
          placeholder="用于找回密码或接收周报" 
          required 
          disabled={loading}
        />
      </div>

      <div class="form-group">
        <label for="password">密码</label>
        <input 
          type="password" 
          id="password" 
          bind:value={password} 
          placeholder="请输入密码（至少6位）" 
          required 
          disabled={loading}
        />
      </div>

      <div class="form-group">
        <label for="confirmPassword">确认密码</label>
        <input 
          type="password" 
          id="confirmPassword" 
          bind:value={confirmPassword} 
          placeholder="请再次输入密码" 
          required 
          disabled={loading}
        />
      </div>

      <button type="submit" class="submit-btn" disabled={loading}>
        {#if loading}
          正在注册...
        {:else}
          注册
        {/if}
      </button>
    </form>

    <div class="card-footer">
      <span>已有账号？</span>
      <a href="/login">直接登录</a>
    </div>
  </div>
</div>

<style>
  .register-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background-color: var(--color-bg);
    padding: var(--spacing-base);
    font-family: var(--font-sans);
  }

  .register-card {
    background-color: var(--color-card);
    width: 100%;
    max-width: 400px;
    padding: var(--spacing-xl);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--color-border);
  }

  .brand {
    text-align: center;
    margin-bottom: var(--spacing-xl);
  }

  .logo {
    width: 60px;
    height: 60px;
    background-color: var(--color-primary);
    color: #ffffff;
    font-size: var(--fs-2xl);
    font-weight: var(--fw-bold);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-sm);
    box-shadow: 0 4px 10px rgba(43, 190, 115, 0.2);
  }

  h1 {
    font-size: var(--fs-xl);
    font-weight: var(--fw-bold);
    color: var(--color-text);
    margin-bottom: var(--spacing-xs);
  }

  .subtitle {
    font-size: var(--fs-sm);
    color: var(--color-text-secondary);
  }

  .register-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-base);
  }

  .error-banner {
    background-color: var(--color-danger-light);
    color: var(--color-danger);
    padding: var(--spacing-sm) var(--spacing-base);
    border-radius: var(--radius-md);
    font-size: var(--fs-sm);
    border: 1px solid rgba(255, 77, 79, 0.2);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .form-group label {
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
    color: var(--color-text);
  }

  .form-group input {
    padding: var(--spacing-sm) var(--spacing-base);
    font-size: var(--fs-base);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background-color: var(--color-card);
    outline: none;
    transition: all var(--transition-fast);
  }

  .form-group input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(43, 190, 115, 0.1);
  }

  .submit-btn {
    background-color: var(--color-primary);
    color: #ffffff;
    border: none;
    border-radius: var(--radius-md);
    padding: var(--spacing-sm) var(--spacing-base);
    font-size: var(--fs-md);
    font-weight: var(--fw-semibold);
    cursor: pointer;
    transition: background-color var(--transition-fast);
    margin-top: var(--spacing-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    height: 42px;
  }

  .submit-btn:hover {
    background-color: var(--color-primary-hover);
  }

  .submit-btn:disabled {
    background-color: var(--color-border);
    color: var(--color-text-secondary);
    cursor: not-allowed;
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    font-size: var(--fs-sm);
    color: var(--color-text-secondary);
    margin-top: var(--spacing-lg);
  }

  .card-footer a {
    color: var(--color-primary);
    text-decoration: none;
    font-weight: var(--fw-medium);
  }

  .card-footer a:hover {
    text-decoration: underline;
  }
</style>
