import { API_ORIGIN } from "../../services/api/client.js";
import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export const ImageGenerator = ({ open, onClose }: Props) => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);

  if (!open) return null;

  const generate = async () => {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_ORIGIN}/v1/tools/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Image request failed (${res.status})`);
      }

      if (!data.image) {
        throw new Error(data.error || "No image returned");
      }

      setImage(
        data.image.startsWith("http")
          ? data.image
          : `data:${data.mimeType || "image/png"};base64,${data.image}`
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Image generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: 14,
      margin: 10,
      borderRadius: 18,
      border: "1px solid rgba(128,128,128,.25)",
      background: "var(--dsw-specific-input-major)",
      color: "var(--dsw-alias-label-primary)"
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12
      }}>
        <strong>Create an image</strong>
        <button type="button" onClick={onClose}
          aria-label="Close image generator"
          style={{
            border: 0,
            background: "transparent",
            color: "inherit",
            fontSize: 23,
            cursor: "pointer"
          }}>×</button>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") void generate();
          }}
          placeholder="Describe the image you want..."
          style={{
            flex: 1,
            minWidth: 0,
            padding: 12,
            borderRadius: 13,
            border: "1px solid rgba(128,128,128,.3)",
            background: "transparent",
            color: "inherit"
          }}
        />
        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading || !prompt.trim()}
          style={{
            padding: "9px 13px",
            border: 0,
            borderRadius: 13,
            background: "#2563eb",
            color: "white",
            opacity: loading || !prompt.trim() ? 0.5 : 1
          }}
        >
          {loading ? "..." : "Generate"}
        </button>
      </div>

      {image && (
        <div style={{ marginTop: 12 }}>
          <img
            src={image}
            alt={prompt}
            style={{ width: "100%", borderRadius: 14 }}
          />
        </div>
      )}
    </div>
  );
};
