"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { healthCheck } from "@/lib/supabase";
import { clsx } from "clsx";

export function StatusBar() {
  const { status, isConnected, setIsConnected } = useAppStore();

  // Check backend connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const health = await healthCheck();
        setIsConnected(health.status === "healthy" || health.status === "degraded");
      } catch {
        setIsConnected(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [setIsConnected]);

  const getStatusConfig = () => {
    switch (status) {
      case "idle":
        return { label: "대기 중", color: "bg-green-500", pulse: false };
      case "listening":
        return { label: "듣는 중...", color: "bg-yellow-500", pulse: true };
      case "processing":
        return { label: "처리 중...", color: "bg-blue-500", pulse: true };
      case "thinking":
        return { label: "생각 중...", color: "bg-purple-500", pulse: true };
      case "speaking":
        return { label: "말하는 중...", color: "bg-cyan-500", pulse: true };
      case "error":
        return { label: "오류", color: "bg-red-500", pulse: false };
      default:
        return { label: "알 수 없음", color: "bg-gray-500", pulse: false };
    }
  };

  const { label, color, pulse } = getStatusConfig();

  return (
    <div className="flex items-center justify-between bg-gray-800/80 backdrop-blur-sm rounded-lg px-4 py-2">
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <div
          className={clsx(
            "w-3 h-3 rounded-full",
            color,
            pulse && "recording-indicator"
          )}
        />
        <span className="text-sm font-medium">{label}</span>
      </div>

      {/* Connection status */}
      <div className="flex items-center gap-2">
        <div
          className={clsx(
            "w-2 h-2 rounded-full",
            isConnected ? "bg-green-500" : "bg-red-500"
          )}
        />
        <span className="text-xs text-gray-400">
          {isConnected ? "서버 연결됨" : "서버 연결 안됨"}
        </span>
      </div>
    </div>
  );
}
