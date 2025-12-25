"use client";

import { useState } from "react";
import { submitEmailSignup } from "@/lib/supabase";

export function EmailSignup() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !email.includes("@")) {
      setError("올바른 이메일을 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      await submitEmailSignup(email);
      setSubmitted(true);
    } catch (err) {
      setError("신청 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl p-4 text-center">
        <h3 className="text-base font-semibold mb-1">신청 완료!</h3>
        <p className="text-gray-400 text-sm">
          서비스가 준비되면 연락드리겠습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl p-4">
      <p className="text-gray-400 text-sm mb-3 text-center">
        나만의 AI 도플갱어를 만들고 싶으신가요? 이메일을 남겨주세요.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          disabled={loading}
          className="flex-1 bg-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? "..." : "신청"}
        </button>
      </form>
      {error && <p className="text-red-400 text-sm mt-2 text-center">{error}</p>}
    </div>
  );
}
