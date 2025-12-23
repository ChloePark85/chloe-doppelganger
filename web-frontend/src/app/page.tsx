"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { ChatPanel } from "@/components/ChatPanel";
import { StatusBar } from "@/components/StatusBar";
import { useAppStore } from "@/lib/store";

// Dynamic import for Three.js components (no SSR)
const AvatarViewer = dynamic(() => import("@/components/AvatarViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-400">Loading 3D Viewer...</div>
    </div>
  ),
});

export default function Home() {
  const { status } = useAppStore();

  return (
    <main className="flex h-screen">
      {/* Left: 3D Avatar Viewer */}
      <div className="flex-1 relative">
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
      </div>

      {/* Right: Chat Panel */}
      <div className="w-[400px] border-l border-gray-700 flex flex-col">
        <ChatPanel />
      </div>
    </main>
  );
}
