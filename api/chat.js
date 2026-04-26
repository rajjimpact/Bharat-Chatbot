/**
 * Bharat Chatbot — api/chat.js
 * Native Vercel Node.js Serverless Function
 * Provider: xAI Grok (model: grok-beta) with 2-key rotation
 *
 * Environment Variables (set in Vercel Dashboard → Settings → Environment Variables):
 *   GROK_API_KEY_1  — Your first xAI Grok API key
 *   GROK_API_KEY_2  — Your second xAI Grok API key
 *
 * Get free keys at: https://console.x.ai
 */

export default async function handler(req, res) {
  // ─── CORS Headers ─────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // ─── Read Body ────────────────────────────────────────────────────────────
  const { message = '', history = [], mediaBase64 = '', mediaMime = '' } = req.body || {};

  if (!message && !mediaBase64) {
    return res.status(400).json({ error: 'Empty message.' });
  }

  // ─── Load API Keys (from environment variables ONLY) ──────────────────────
  const keys = [
    process.env.GROK_API_KEY_1,
    process.env.GROK_API_KEY_2,
  ].filter(k => k && k.trim() !== '');

  if (keys.length === 0) {
    return res.status(500).json({
      error: '⚙️ No API keys configured. Please add GROK_API_KEY_1 and GROK_API_KEY_2 in your Vercel project Environment Variables at vercel.com/dashboard.'
    });
  }

  // ─── Build Message Array ──────────────────────────────────────────────────
  const messages = [
    {
      role: 'system',
      content:
        "You are Bharat, a friendly and knowledgeable AI assistant. " +
        "You are an expert in programming, health & wellness, food recipes, " +
        "social etiquette, science, history, and general knowledge. " +
        "Always respond in clear, well-structured markdown. " +
        "Be concise, helpful, and warm in tone."
    }
  ];

  // Add conversation history (last 10 turns)
  const recentHistory = Array.isArray(history) ? history.slice(-10) : [];
  for (const turn of recentHistory) {
    const role = turn.role === 'bot' ? 'assistant' : 'user';
    const text = (turn.text || '').trim();
    if (text) messages.push({ role, content: text });
  }

  // Build user message content (supports vision/image if provided)
  let userContent;
  if (mediaBase64 && mediaMime) {
    userContent = [
      { type: 'text', text: message || 'Describe what you see in this image in detail.' },
      { type: 'image_url', image_url: { url: `data:${mediaMime};base64,${mediaBase64}` } }
    ];
  } else {
    userContent = message;
  }

  messages.push({ role: 'user', content: userContent });

  // ─── Call Grok API with Key Rotation ─────────────────────────────────────
  // Tries key 1 first. If rate-limited (429), automatically falls over to key 2.
  let lastError = 'Unknown error';

  for (let i = 0; i < keys.length; i++) {
    const apiKey = keys[i];
    const keyLabel = `GROK_API_KEY_${i + 1}`;

    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'grok-beta',
          messages,
          temperature: 0.75,
          max_tokens: 1024
        })
      });

      // Rate limit hit on this key — rotate to the next one
      if (response.status === 429) {
        lastError = `Rate limit reached on ${keyLabel}.`;
        continue;
      }

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        let errMsg = errBody;
        try { const j = JSON.parse(errBody); errMsg = j.error?.message || j.message || errBody; } catch(_) {}
        lastError = `API Error ${response.status} on ${keyLabel}: ${errMsg}`;
        continue;
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content?.trim();

      if (!reply) {
        return res.status(500).json({ error: 'Received an empty response from the AI. Please try again.' });
      }

      return res.status(200).json({
        reply,
        timestamp: new Date().toISOString(),
        model: 'grok-3-mini',
        version: '3.0.0'
      });

    } catch (err) {
      lastError = `Network error on ${keyLabel}: ${err.message}`;
      continue;
    }
  }

  // All keys failed
  return res.status(503).json({
    error: `⚠️ All API keys are currently unavailable. Last error: ${lastError}`
  });
}
