"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setLoading(true); setError("");
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) { setError("邮箱或密码错误"); }
      else { router.push("/"); router.refresh(); }
    } catch {
      setError("网络异常，请检查连接后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <Link href="/" className="text-[22px] font-semibold tracking-tight">SportMatch</Link>
          <p className="text-[14px] text-[var(--color-text-secondary)] mt-2">登录你的账号</p>
        </div>

        <form className="space-y-4">
          {error && <div className="bg-[#fde8ec] text-[#b01030] text-[13px] rounded-xl px-4 py-3">{error}</div>}

          <div>
            <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">邮箱</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-subtle)] transition-colors"
              placeholder="your@email.com" />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">密码</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-subtle)] transition-colors"
              placeholder="输入密码" />
          </div>

          <button type="button" onClick={handleLogin} disabled={loading}
            className="w-full py-3 text-[15px] font-medium rounded-full bg-[#3b73ff] text-white hover:opacity-90 disabled:opacity-30 transition-opacity">
            {loading ? "登录中..." : "登录"}
          </button>

          <p className="text-center text-[13px] text-[var(--color-text-tertiary)]">
            还没有账号？ <Link href="/auth/register" className="text-[var(--color-brand)] hover:underline font-medium">注册</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center text-[var(--color-text-tertiary)]">加载中...</div>}>
      <LoginForm />
    </Suspense>
  );
}
