export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  try {
    // Free, no API key needed (Pollinations.ai)
    const response = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`);
    
    if (!response.ok) {
      throw new Error(`Pollinations API failed with status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    // Return exactly the same format the frontend expects
    res.status(200).json({ image: base64 });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to generate image" });
  }
}
