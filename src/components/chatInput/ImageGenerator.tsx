import { API_ORIGIN } from "../../services/api/client.js";
import React, { useState } from 'react';

export const ImageGenerator = () => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_ORIGIN}/v1/tools/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      if (data.image) {
        // Detect if it's base64 or a direct URL
        const imgSrc = data.image.startsWith('http') ? data.image : `data:image/jpeg;base64,${data.image}`;
        setImage(imgSrc);
      } else {
        alert("Failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Network error generating image");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '10px', borderTop: '1px solid #ccc', marginTop: '10px' }}>
      <div style={{ display: 'flex', gap: '5px' }}>
        <input 
          type="text" 
          value={prompt} 
          onChange={e => setPrompt(e.target.value)} 
          placeholder="Describe an image to generate..." 
          style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: '#fff' }}
        />
        <button onClick={generate} disabled={loading} style={{ padding: '8px 12px', cursor: loading ? 'wait' : 'pointer', background: '#4a90e2', color: '#fff', border: 'none', borderRadius: '4px' }}>
          {loading ? '🎨...' : '🎨 Generate'}
        </button>
      </div>
      {image && (
        <div style={{ marginTop: '10px' }}>
          <img src={image} alt={prompt} style={{ maxWidth: '100%', borderRadius: '8px' }} />
        </div>
      )}
    </div>
  );
};
