import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { TopNav } from "@/components/layout/TopNav";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Doums · 拼豆库存管理",
  description: "MARD 色号拼豆库存与消耗管理",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${jetbrains.variable}`}>
      <body>
        <TopNav />
        <main className="mx-auto min-h-[calc(100vh-3.5rem)] max-w-6xl px-4 py-8 md:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
