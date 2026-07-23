/**
 * Bharat Chatbot — api/chat.js
 * Native Vercel Node.js Serverless Function
 * Provider: xAI Grok (model: grok-beta) with 5-key rotation
 *
 * Environment Variables (set in Vercel Dashboard → Settings → Environment Variables):
 *   GROK_API_KEY_1  — Your 1st xAI Grok API key
 *   GROK_API_KEY_2  — Your 2nd xAI Grok API key
 *   GROK_API_KEY_3  — Your 3rd xAI Grok API key
 *   GROK_API_KEY_4  — Your 4th xAI Grok API key
 *   GROK_API_KEY_5  — Your 5th xAI Grok API key
 *
 * Rotation Strategy:
 *   - Starts from a random key each request (load balancing)
 *   - On 429 (rate limit) or any API error, automatically rotates to the next key
 *   - Cycles through all 5 keys before giving up
 *   - Returns 503 only if ALL keys are exhausted
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
  // Up to 5 keys — add only the ones you have; missing ones are safely ignored.
  const allKeys = [
    { key: process.env.GROK_API_KEY_1, label: 'GROK_API_KEY_1' },
    { key: process.env.GROK_API_KEY_2, label: 'GROK_API_KEY_2' },
    { key: process.env.GROK_API_KEY_3, label: 'GROK_API_KEY_3' },
    { key: process.env.GROK_API_KEY_4, label: 'GROK_API_KEY_4' },
    { key: process.env.GROK_API_KEY_5, label: 'GROK_API_KEY_5' },
  ].filter(entry => entry.key && entry.key.trim() !== '');

  if (allKeys.length === 0) {
    return res.status(500).json({
      error: '⚙️ No API keys configured. Please add GROK_API_KEY_1 through GROK_API_KEY_5 in your Vercel project Environment Variables at vercel.com/dashboard.'
    });
  }

  // ─── Smart Key Rotation: Start from a random offset for load balancing ────
  // This distributes traffic across keys so no single key always takes the first hit.
  const startIndex = Math.floor(Math.random() * allKeys.length);

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

  // ─── Call Grok API with 5-Key Rotation ───────────────────────────────────
  // Starts from a random key and cycles through all available keys.
  // Rotates on: 429 (rate limit), 401 (invalid/expired key), 5xx (server errors).
  const errors = [];

  for (let attempt = 0; attempt < allKeys.length; attempt++) {
    const index = (startIndex + attempt) % allKeys.length;
    const { key: apiKey, label: keyLabel } = allKeys[index];

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

      // ── Rotate on rate limit ──────────────────────────────────────────────
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '?';
        errors.push(`[${keyLabel}] Rate limited (retry-after: ${retryAfter}s) — rotating to next key.`);
        continue;
      }

      // ── Rotate on invalid/expired key ────────────────────────────────────
      if (response.status === 401) {
        errors.push(`[${keyLabel}] Invalid or expired key — rotating to next key.`);
        continue;
      }

      // ── Rotate on server-side errors ─────────────────────────────────────
      if (response.status >= 500) {
        errors.push(`[${keyLabel}] Server error ${response.status} — rotating to next key.`);
        continue;
      }

      // ── Any other non-OK response — rotate ───────────────────────────────
      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        let errMsg = errBody;
        try { const j = JSON.parse(errBody); errMsg = j.error?.message || j.message || errBody; } catch (_) {}
        errors.push(`[${keyLabel}] API Error ${response.status}: ${errMsg}`);
        continue;
      }

      // ── Success ───────────────────────────────────────────────────────────
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content?.trim();

      if (!reply) {
        return res.status(500).json({ error: 'Received an empty response from the AI. Please try again.' });
      }

      return res.status(200).json({
        reply,
        timestamp: new Date().toISOString(),
        model: 'grok-beta',
        keyUsed: keyLabel,         // Useful for debugging which key served the request
        keysAvailable: allKeys.length,
        version: '3.1.0'
      });

    } catch (err) {
      // Network-level error (DNS, timeout, etc.) — rotate to next key
      errors.push(`[${keyLabel}] Network error: ${err.message}`);
      continue;
    }
  }

  // ─── All Keys Exhausted ───────────────────────────────────────────────────
  console.error('All Grok API keys failed:', errors);
  return res.status(503).json({
    error: `⚠️ All ${allKeys.length} API keys are currently unavailable or rate-limited. Please try again shortly.`,
    details: errors
  });
}
