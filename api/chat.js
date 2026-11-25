export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify(req.body)
  });

  res.writeHead(response.status, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  for await (const chunk of response.body) {
    res.write(chunk);
  }
  res.end();
}
