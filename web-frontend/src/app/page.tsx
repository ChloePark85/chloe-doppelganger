"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { ChatPanel } from "@/components/ChatPanel";
import { StatusBar } from "@/components/StatusBar";
import { EmailSignup } from "@/components/EmailSignup";

// Dynamic import for Three.js components (no SSR)
const AvatarViewer = dynamic(() => import("@/components/AvatarViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gradient-to-b from-gray-900 to-gray-800">
      <div className="text-gray-400">Loading 3D Viewer...</div>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="flex h-screen">
      {/* Left: 3D Avatar Viewer */}
      <div className="flex-1 relative bg-gradient-to-b from-gray-900 to-gray-800">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-400">Loading...</div>
            </div>
          }
        >
          <AvatarViewer />
        </Suspense>

        {/* Status Bar Overlay */}
        <div className="absolute top-4 left-4 right-4">
          <StatusBar />
        </div>

        {/* Branding */}
        <div className="absolute bottom-4 left-4">
          <h1 className="text-2xl font-bold text-white">Coffeechat with Chloe</h1>
          <p className="text-gray-400 text-sm">AI 도플갱어와 대화하고 커피챗을 예약하세요</p>
        </div>

        {/* Email Signup Form */}
        <div className="absolute bottom-4 right-4 w-80">
          <EmailSignup />
        </div>
      </div>

      {/* Right: Chat Panel */}
      <div className="w-[420px] border-l border-gray-700 flex flex-col">
        <ChatPanel />
      </div>
    </main>
  );
}
