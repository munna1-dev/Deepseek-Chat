export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: 'Image generation is not configured.'
    });
  }

  const prompt = req.body?.prompt;

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({
      error: 'A valid image prompt is required.'
    });
  }

  if (prompt.length > 4000) {
    return res.status(400).json({
      error: 'Prompt is too long.'
    });
  }

  try {
    const response = await fetch(
      'https://api.openai.com/v1/images/generations',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: prompt.trim(),
          n: 1,
          size: '1024x1024'
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI image API error:', data);
      return res.status(response.status).json({
        error: data.error?.message || 'Image generation failed.'
      });
    }

    const image = data.data?.[0]?.b64_json;

    if (!image) {
      return res.status(502).json({
        error: 'No image was returned by the image provider.'
      });
    }

    return res.status(200).json({
      image,
      format: 'png'
    });

  } catch (error) {
    console.error('Image generation error:', error);

    return res.status(500).json({
      error: 'Image generation service unavailable.'
    });
  }
}
