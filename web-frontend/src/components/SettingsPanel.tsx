"use client";

import { useState, useEffect, useRef } from "react";
import { clsx } from "clsx";

type SettingsTab = "persona" | "knowledge" | "memory" | "calendar";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("persona");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">설정</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {[
            { id: "persona", label: "페르소나", icon: "👤" },
            { id: "knowledge", label: "지식 관리", icon: "📚" },
            { id: "memory", label: "메모리", icon: "🧠" },
            { id: "calendar", label: "캘린더", icon: "📅" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={clsx(
                "flex-1 px-4 py-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-gray-700 text-white border-b-2 border-primary-500"
                  : "text-gray-400 hover:text-white hover:bg-gray-700/50"
              )}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "persona" && <PersonaSettings />}
          {activeTab === "knowledge" && <KnowledgeSettings />}
          {activeTab === "memory" && <MemorySettings />}
          {activeTab === "calendar" && <CalendarSettings />}
        </div>
      </div>
    </div>
  );
}

function PersonaSettings() {
  const [persona, setPersona] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPersona();
  }, []);

  const fetchPersona = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/persona");
      const data = await res.json();
      setPersona(data);
    } catch (error) {
      console.error("Failed to fetch persona:", error);
    } finally {
      setLoading(false);
    }
  };

  const savePersona = async () => {
    setSaving(true);
    try {
      await fetch("http://localhost:8000/api/persona", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(persona),
      });
      alert("저장되었습니다!");
    } catch (error) {
      console.error("Failed to save persona:", error);
      alert("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center text-gray-400">로딩 중...</div>;
  if (!persona) return <div className="text-center text-gray-400">설정을 불러올 수 없습니다</div>;

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <section>
        <h3 className="text-lg font-semibold mb-4">기본 정보</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">이름</label>
            <input
              type="text"
              value={persona.name || ""}
              onChange={(e) => setPersona({ ...persona, name: e.target.value })}
              className="w-full bg-gray-700 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">직업</label>
            <input
              type="text"
              value={persona.background?.occupation || ""}
              onChange={(e) =>
                setPersona({
                  ...persona,
                  background: { ...persona.background, occupation: e.target.value },
                })
              }
              className="w-full bg-gray-700 rounded-lg px-3 py-2"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm text-gray-400 mb-1">소개</label>
          <textarea
            value={persona.description || ""}
            onChange={(e) => setPersona({ ...persona, description: e.target.value })}
            className="w-full bg-gray-700 rounded-lg px-3 py-2 h-20"
          />
        </div>
      </section>

      {/* Personality */}
      <section>
        <h3 className="text-lg font-semibold mb-4">성격 설정</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">말투</label>
            <select
              value={persona.personality?.tone || "friendly"}
              onChange={(e) =>
                setPersona({
                  ...persona,
                  personality: { ...persona.personality, tone: e.target.value },
                })
              }
              className="w-full bg-gray-700 rounded-lg px-3 py-2"
            >
              <option value="friendly">친근한</option>
              <option value="formal">격식 있는</option>
              <option value="casual">편한</option>
              <option value="professional">전문적인</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">존댓말</label>
            <select
              value={persona.communication?.honorific || "polite"}
              onChange={(e) =>
                setPersona({
                  ...persona,
                  communication: { ...persona.communication, honorific: e.target.value },
                })
              }
              className="w-full bg-gray-700 rounded-lg px-3 py-2"
            >
              <option value="casual">반말</option>
              <option value="polite">존댓말</option>
              <option value="formal">높임말</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">유머</label>
            <select
              value={persona.personality?.humor || "moderate"}
              onChange={(e) =>
                setPersona({
                  ...persona,
                  personality: { ...persona.personality, humor: e.target.value },
                })
              }
              className="w-full bg-gray-700 rounded-lg px-3 py-2"
            >
              <option value="none">없음</option>
              <option value="subtle">약간</option>
              <option value="moderate">적당히</option>
              <option value="high">많이</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">답변 길이</label>
            <select
              value={persona.personality?.verbosity || "balanced"}
              onChange={(e) =>
                setPersona({
                  ...persona,
                  personality: { ...persona.personality, verbosity: e.target.value },
                })
              }
              className="w-full bg-gray-700 rounded-lg px-3 py-2"
            >
              <option value="concise">간결하게</option>
              <option value="balanced">적당히</option>
              <option value="detailed">상세하게</option>
            </select>
          </div>
        </div>
      </section>

      {/* Expertise & Interests */}
      <section>
        <h3 className="text-lg font-semibold mb-4">전문 분야 & 관심사</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">전문 분야 (쉼표로 구분)</label>
            <input
              type="text"
              value={persona.background?.expertise?.join(", ") || ""}
              onChange={(e) =>
                setPersona({
                  ...persona,
                  background: {
                    ...persona.background,
                    expertise: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean),
                  },
                })
              }
              className="w-full bg-gray-700 rounded-lg px-3 py-2"
              placeholder="예: AI, 프로그래밍, 디자인"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">관심사 (쉼표로 구분)</label>
            <input
              type="text"
              value={persona.background?.interests?.join(", ") || ""}
              onChange={(e) =>
                setPersona({
                  ...persona,
                  background: {
                    ...persona.background,
                    interests: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean),
                  },
                })
              }
              className="w-full bg-gray-700 rounded-lg px-3 py-2"
              placeholder="예: 음악, 여행, 독서"
            />
          </div>
        </div>
      </section>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={savePersona}
          disabled={saving}
          className="px-6 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}

function KnowledgeSettings() {
  const [stats, setStats] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/documents/stats");
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("chunk_size", "500");

    try {
      const res = await fetch("http://localhost:8000/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      alert(`${data.chunks_added}개의 청크가 추가되었습니다!`);
      fetchStats();
    } catch (error) {
      console.error("Upload failed:", error);
      alert("업로드 실패");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold mb-4">문서 업로드</h3>
        <p className="text-gray-400 text-sm mb-4">
          PDF, TXT, DOCX, MD 파일을 업로드하면 도플갱어가 해당 내용을 학습합니다.
        </p>
        <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.docx,.md"
            onChange={handleUpload}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className={clsx(
              "cursor-pointer inline-block px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium",
              uploading && "opacity-50 cursor-not-allowed"
            )}
          >
            {uploading ? "업로드 중..." : "파일 선택"}
          </label>
          <p className="text-gray-500 text-sm mt-2">
            지원 형식: PDF, TXT, DOCX, MD
          </p>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">저장된 지식</h3>
        {stats ? (
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-400">총 문서 수</span>
                <p className="text-2xl font-bold">{stats.total_documents}</p>
              </div>
              <div>
                <span className="text-gray-400">인덱스 크기</span>
                <p className="text-2xl font-bold">{stats.index_size}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-400">로딩 중...</p>
        )}
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">빠른 정보 입력</h3>
        <QuickFactInput />
      </section>
    </div>
  );
}

function QuickFactInput() {
  const [category, setCategory] = useState("personal");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const saveFact = async () => {
    if (!key || !value) return;

    setSaving(true);
    const formData = new FormData();
    formData.append("category", category);
    formData.append("key", key);
    formData.append("value", value);

    try {
      await fetch("http://localhost:8000/api/memory/facts", {
        method: "POST",
        body: formData,
      });
      alert("저장되었습니다!");
      setKey("");
      setValue("");
    } catch (error) {
      console.error("Failed to save fact:", error);
      alert("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-700 rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">카테고리</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-gray-600 rounded-lg px-3 py-2"
          >
            <option value="personal">개인정보</option>
            <option value="work">업무</option>
            <option value="preferences">선호도</option>
            <option value="contacts">연락처</option>
            <option value="other">기타</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">항목</label>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="예: 생일"
            className="w-full bg-gray-600 rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">내용</label>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="예: 1월 15일"
            className="w-full bg-gray-600 rounded-lg px-3 py-2"
          />
        </div>
      </div>
      <button
        onClick={saveFact}
        disabled={saving || !key || !value}
        className="w-full py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium disabled:opacity-50"
      >
        {saving ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}

function MemorySettings() {
  const [facts, setFacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFacts();
  }, []);

  const fetchFacts = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/memory/facts");
      const data = await res.json();
      setFacts(data.facts || []);
    } catch (error) {
      console.error("Failed to fetch facts:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteFact = async (category: string, key: string) => {
    if (!confirm("이 정보를 삭제하시겠습니까?")) return;

    try {
      await fetch(`http://localhost:8000/api/memory/facts?category=${category}&key=${key}`, {
        method: "DELETE",
      });
      fetchFacts();
    } catch (error) {
      console.error("Failed to delete fact:", error);
    }
  };

  if (loading) return <div className="text-center text-gray-400">로딩 중...</div>;

  // Group by category
  const grouped = facts.reduce((acc, fact) => {
    if (!acc[fact.category]) acc[fact.category] = [];
    acc[fact.category].push(fact);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold mb-4">저장된 정보</h3>
        {facts.length === 0 ? (
          <p className="text-gray-400">저장된 정보가 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-primary-400 mb-2 capitalize">{category}</h4>
                <div className="space-y-2">
                  {(items as any[]).map((fact) => (
                    <div key={fact.id} className="flex justify-between items-center">
                      <div>
                        <span className="text-gray-400">{fact.key}:</span>{" "}
                        <span>{fact.value}</span>
                      </div>
                      <button
                        onClick={() => deleteFact(fact.category, fact.key)}
                        className="text-red-400 hover:text-red-300"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CalendarSettings() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/calendar/status");
      const data = await res.json();
      setAuthenticated(data.authenticated);
      if (data.authenticated) {
        fetchEvents();
      }
    } catch (error) {
      console.error("Failed to check auth:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/calendar/events?limit=5");
      const data = await res.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error("Failed to fetch events:", error);
    }
  };

  const connectCalendar = async () => {
    try {
      const redirectUri = `${window.location.origin}/api/calendar/callback`;
      const res = await fetch(
        `http://localhost:8000/api/calendar/auth?redirect_uri=${encodeURIComponent(redirectUri)}`
      );
      const data = await res.json();
      window.open(data.auth_url, "_blank", "width=500,height=600");
    } catch (error) {
      console.error("Failed to get auth URL:", error);
      alert("Google Calendar 설정이 필요합니다. google_credentials.json 파일을 확인하세요.");
    }
  };

  const disconnectCalendar = async () => {
    if (!confirm("Google Calendar 연결을 해제하시겠습니까?")) return;

    try {
      await fetch("http://localhost:8000/api/calendar/disconnect", { method: "POST" });
      setAuthenticated(false);
      setEvents([]);
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  };

  if (loading) return <div className="text-center text-gray-400">로딩 중...</div>;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold mb-4">Google Calendar 연동</h3>
        {authenticated ? (
          <div>
            <div className="flex items-center gap-2 text-green-400 mb-4">
              <span>✓</span> 연결됨
            </div>
            <button
              onClick={disconnectCalendar}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg"
            >
              연결 해제
            </button>
          </div>
        ) : (
          <div>
            <p className="text-gray-400 mb-4">
              Google Calendar를 연결하면 도플갱어가 커피챗 일정을 잡아줄 수 있습니다.
            </p>
            <button
              onClick={connectCalendar}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium"
            >
              Google Calendar 연결
            </button>
          </div>
        )}
      </section>

      {authenticated && (
        <section>
          <h3 className="text-lg font-semibold mb-4">예정된 일정</h3>
          {events.length === 0 ? (
            <p className="text-gray-400">예정된 일정이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div key={event.id} className="bg-gray-700 rounded-lg p-3">
                  <div className="font-medium">{event.title}</div>
                  <div className="text-sm text-gray-400">
                    {new Date(event.start).toLocaleString("ko-KR")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="bg-gray-700 rounded-lg p-4">
        <h4 className="font-medium mb-2">설정 안내</h4>
        <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
          <li>Google Cloud Console에서 프로젝트 생성</li>
          <li>Calendar API 활성화</li>
          <li>OAuth 2.0 클라이언트 ID 생성</li>
          <li>credentials.json 다운로드</li>
          <li>python-backend/data/ 폴더에 google_credentials.json으로 저장</li>
        </ol>
      </section>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
