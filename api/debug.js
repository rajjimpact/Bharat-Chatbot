/**
 * Bharat Chatbot — api/debug.js
 * Temporary debug endpoint to verify environment variables are loaded in Vercel.
 * ⚠️ DELETE THIS FILE after debugging — it exposes key presence info.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const keys = {
    GROK_API_KEY_1: process.env.GROK_API_KEY_1,
    GROK_API_KEY_2: process.env.GROK_API_KEY_2,
    GROK_API_KEY_3: process.env.GROK_API_KEY_3,
    GROK_API_KEY_4: process.env.GROK_API_KEY_4,
    GROK_API_KEY_5: process.env.GROK_API_KEY_5,
  };

  const report = {};
  let foundCount = 0;

  for (const [name, val] of Object.entries(keys)) {
    const present = !!(val && val.trim());
    if (present) foundCount++;
    report[name] = present
      ? `✅ SET (starts with: ${val.slice(0, 6)}...)`
      : '❌ MISSING or EMPTY';
  }

  return res.status(200).json({
    status: foundCount > 0 ? 'OK' : 'NO_KEYS_FOUND',
    keysFound: foundCount,
    details: report,
    note: '⚠️ Delete api/debug.js after you are done debugging!'
  });
}
