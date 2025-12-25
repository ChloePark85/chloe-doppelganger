"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { SubtitleChat } from "@/components/SubtitleChat";
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
    <main className="flex flex-col h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      {/* Header */}
      <div className="p-4 text-center">
        <h1 className="text-2xl font-bold text-white">Coffeechat with Chloe</h1>
        <p className="text-gray-400 text-sm">음성 또는 텍스트로 대화하고 커피챗을 예약하세요</p>
      </div>

      {/* 3D Avatar */}
      <div className="flex-1 relative min-h-0">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-400">Loading...</div>
            </div>
          }
        >
          <AvatarViewer />
        </Suspense>

        {/* Status Bar */}
        <div className="absolute top-4 left-4 right-4">
          <StatusBar />
        </div>
      </div>

      {/* Subtitle + Input Area */}
      <div className="p-4">
        <SubtitleChat />
      </div>

      {/* Email Signup - Bottom */}
      <div className="border-t border-gray-700 bg-gray-800/50 p-4">
        <div className="max-w-md mx-auto">
          <EmailSignup />
        </div>
      </div>
    </main>
  );
}
