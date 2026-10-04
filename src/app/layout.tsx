import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/register-service-worker";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Personal calendar, to-do, and notes dashboard",
  // iPhone home-screen app: full-screen, with a black status bar that sits
  // above the page instead of covering it.
  appleWebApp: { capable: true, title: "Dashboard", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  themeColor: "#070b14",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
