import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ThemeProvider from "@/lib/themes/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AIOS",
  description: "AI Operating System — canvas-based context management for LLM conversations",
};

/** Blocking script that applies saved theme colors before first paint. */
/** Blocking script that applies saved theme colors + color-scheme before first paint. */
const themeScript = `(function(){try{var c=JSON.parse(localStorage.getItem("aios-theme-colors"));if(c){var s=document.documentElement.style;for(var k in c)s.setProperty("--"+k,c[k])}var t=localStorage.getItem("aios-theme-type");if(t)s.colorScheme=t}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
