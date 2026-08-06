import type { Metadata } from "next";
import { Cinzel, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SystemToastProvider } from "@/ui/components/primitives/SystemToast";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "SYSTEM | Solo Leveling Gym",
  description: "The System has chosen you. Arise.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${cinzel.variable} ${inter.variable} ${jetbrains.variable} bg-void min-h-screen`}
      >
        <div className="noise-overlay" />
        {children}
        <SystemToastProvider />
      </body>
    </html>
  );
}
