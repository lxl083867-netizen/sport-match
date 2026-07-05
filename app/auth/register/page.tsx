"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import posthog from "posthog-js";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name.trim() || !email.trim() || password.length < 6) return;
    setLoading(true); setError("");

    try {
      await api("/api/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });

      const signInResult = await signIn("credentials", { email, password, redirect: false });
      if (signInResult?.error) {
        setError("自动登录失败，请前往登录页手动登录");
        router.push("/auth/login?email=" + encodeURIComponent(email));
      } else {
        posthog.capture("user_signed_up", { method: "credentials" });
        router.push("/profile/setup");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络异常，请检查连接后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <Link href="/" className="text-[22px] font-semibold tracking-tight">SportMatch</Link>
          <p className="text-[14px] text-[var(--color-text-secondary)] mt-2">创建你的专属运动档案</p>
        </div>

        <form className="space-y-4">
          {error && <div className="bg-[#fde8ec] text-[#b01030] text-[13px] rounded-xl px-4 py-3">{error}</div>}

          <div>
            <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">昵称</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-subtle)] transition-colors"
              placeholder="你的昵称" />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">邮箱</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-subtle)] transition-colors"
              placeholder="your@email.com" />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">密码</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-subtle)] transition-colors"
              placeholder="至少 6 位" />
          </div>

          <button type="button" onClick={handleRegister} disabled={loading}
            className="w-full py-3 text-[15px] font-medium rounded-full bg-[#3b73ff] text-white hover:opacity-90 disabled:opacity-30 transition-opacity">
            {loading ? "注册中..." : "注册并设置运动画像"}
          </button>

          <p className="text-center text-[13px] text-[var(--color-text-tertiary)]">
            已有账号？ <Link href="/auth/login" className="text-[var(--color-brand)] hover:underline font-medium">登录</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
