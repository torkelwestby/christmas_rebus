import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Julerebus 2025 🎄",
  description: "Løs rebusene og lås opp opplevelser for 2026!",
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-green-50 to-red-50">
          {children}
        </div>
      </body>
    </html>
  );
}
