import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chloe Doppelganger",
  description: "AI-powered 3D Avatar Doppelganger",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-gray-900 text-white antialiased">{children}</body>
    </html>
  );
}
