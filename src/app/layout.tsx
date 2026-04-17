import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ToastProvider } from "@/components/toast-provider"
import { UpdateNotification } from "@/components/update-notification"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "VESPR",
  description: "Operations platform for modern businesses",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="h-screen overflow-hidden">
        <TooltipProvider>
          <ToastProvider>
            {children}
            <UpdateNotification />
          </ToastProvider>
        </TooltipProvider>
      </body>
    </html>
  )
}
