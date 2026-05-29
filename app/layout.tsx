import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// 引入现代化极简无衬线字体
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
 });

// 配置系统级医学工作站的 SEO 元数据
// 修正 1：必须加上 const 关键字来声明变量
export const metadata: Metadata = {
  title: "OcularAI - Decentralized Medical Vision Network",
  description: "Next-generation retinal disease screening platform powered by Federated Learning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  // 修正 2：React 的子节点通用类型是 React.ReactNode，而不是 React.createNode
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark select-none">
      <body
        className={`${inter.variable} font-sans antialiased bg-[#09090b] text-slate-100 min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}