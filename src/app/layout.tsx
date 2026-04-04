import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ToastProvider } from "@/components/toast-provider"
import { Sidebar } from "@/components/sidebar"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "VERSPR OS",
  description: "AI Agent Control Center for Business Owners",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="h-screen overflow-hidden">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=JSON.parse(localStorage.getItem("bos-theme"));if(!t)return;var c=[{p:"#2563eb",f:"#ffffff",r:"#2563eb"},{p:"#8b5cf6",f:"#ffffff",r:"#8b5cf6"},{p:"#10b981",f:"#ffffff",r:"#10b981"},{p:"#f59e0b",f:"#000000",r:"#f59e0b"},{p:"#f43f5e",f:"#ffffff",r:"#f43f5e"},{p:"#06b6d4",f:"#000000",r:"#06b6d4"},{p:"#f97316",f:"#000000",r:"#f97316"}];var a=c[t.accentIndex]||c[0];var s=document.documentElement.style;s.setProperty("--primary",a.p);s.setProperty("--primary-foreground",a.f);s.setProperty("--ring",a.r);s.setProperty("--sidebar-ring",a.r);s.setProperty("--chart-1",a.p);if(t.fontSize)document.documentElement.style.fontSize=t.fontSize;if(t.density==="compact")s.setProperty("--spacing","0.2rem")}catch(e){}})()`,
          }}
        />
        <TooltipProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </TooltipProvider>
      </body>
    </html>
  )
}
