import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "轮回仙途｜联机测试境",
  description: "四人共享世界的网页文字修仙联机原型。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
