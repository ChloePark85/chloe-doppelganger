"use client";

import { useState } from "react";

export function EmailSignup() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !email.includes("@")) {
      setError("올바른 이메일을 입력해주세요.");
      return;
    }

    try {
      // TODO: Connect to actual backend endpoint
      // For now, just simulate success
      console.log("Email signup:", email);
      setSubmitted(true);
    } catch (err) {
      setError("신청 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  if (submitted) {
    return (
      <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl p-6 text-center">
        <div className="text-3xl mb-3">✨</div>
        <h3 className="text-lg font-semibold mb-2">신청 완료!</h3>
        <p className="text-gray-400 text-sm">
          나만의 AI 도플갱어 서비스가 준비되면 연락드리겠습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-2">나만의 AI 도플갱어를 만들고 싶으신가요?</h3>
      <p className="text-gray-400 text-sm mb-4">
        이메일을 남겨주시면 서비스 오픈 시 안내해드립니다.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="flex-1 bg-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm font-medium transition-colors"
        >
          신청하기
        </button>
      </form>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}
