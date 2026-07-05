import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import MobileTabBar from "@/components/MobileTabBar";
import ThemeProvider from "@/components/ThemeProvider";
import PostHogProvider from "@/components/PostHogProvider";
import { ToastProvider } from "@/components/Toast";
import { SessionProvider } from "next-auth/react";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: {
    default: "SportMatch — 把收藏的运动视频变成今日训练方案",
    template: "%s | SportMatch",
  },
  description: "把收藏夹里的运动视频变成今天能完成的训练。画像匹配 · AI 筛选 · 补齐热身拉伸。支持 B站/小红书/抖音。",
  keywords: ["运动教程", "健身推荐", "训练计划", "每日训练", "今日训练", "视频跟练", "B站", "小红书", "抖音"],
  authors: [{ name: "SportMatch" }],
  openGraph: {
    title: "SportMatch — 把收藏的运动视频变成今日训练方案",
    description: "把收藏夹里的运动视频变成今天能完成的训练。画像匹配 · AI 筛选 · 补齐热身拉伸。",
    type: "website",
    locale: "zh_CN",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <SessionProvider>
            <Suspense>
              <PostHogProvider>
                <ToastProvider>
                  <NavBar />
                  <main className="flex-1 pb-[calc(49px+env(safe-area-inset-bottom,0px))] lg:pb-0">
                    {children}
                  </main>
                  <MobileTabBar />
                </ToastProvider>
              </PostHogProvider>
            </Suspense>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
