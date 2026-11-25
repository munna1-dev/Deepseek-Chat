"use client";
import { useState } from "react";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input.trim() || loading) return;
    setLoading(true);
    setReply("");

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: input }] }),
    });

    if (!res.ok || !res.body) {
      setReply("Error: " + (await res.text()));
      setLoading(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          text += json.choices?.[0]?.delta?.content ?? "";
          setReply(text);
        } catch {}
      }
    }
    setLoading(false);
  }

  return (
    <main style={{ maxWidth: 640, margin: "3rem auto", padding: "0 1rem" }}>
      <h1>DeepSeek Chat</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask something..."
          style={{ flex: 1, padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
        />
        <button
          onClick={send}
          disabled={loading}
          style={{ padding: "10px 16px", borderRadius: 6, cursor: "pointer" }}
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
      <pre style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{reply}</pre>
    </main>
  );
}
