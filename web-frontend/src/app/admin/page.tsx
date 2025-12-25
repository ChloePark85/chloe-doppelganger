"use client";

import { useState } from "react";
import Link from "next/link";
import { SettingsPanel } from "@/components/SettingsPanel";

export default function AdminPage() {
  const [settingsOpen, setSettingsOpen] = useState(true);

  return (
    <main className="min-h-screen bg-gray-900 p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Coffeechat with Chloe - Admin</h1>
            <p className="text-gray-400 mt-1">페르소나, 지식, 메모리, 캘린더 설정</p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            메인으로 돌아가기
          </Link>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <AdminCard
          icon="👤"
          title="페르소나"
          description="이름, 말투, 성격 설정"
          onClick={() => setSettingsOpen(true)}
        />
        <AdminCard
          icon="📚"
          title="지식 관리"
          description="문서 업로드 및 RAG"
          onClick={() => setSettingsOpen(true)}
        />
        <AdminCard
          icon="🧠"
          title="메모리"
          description="저장된 정보 관리"
          onClick={() => setSettingsOpen(true)}
        />
        <AdminCard
          icon="📅"
          title="캘린더"
          description="Google Calendar 연동"
          onClick={() => setSettingsOpen(true)}
        />
      </div>

      {/* Settings Modal */}
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}

function AdminCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-gray-800 hover:bg-gray-700 rounded-xl p-6 text-left transition-colors"
    >
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </button>
  );
}
