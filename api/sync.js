// api/sync.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, records } = req.body;
  if (!apiKey || !apiKey.startsWith('ext_')) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'Records must be an array' });
  }

  console.log(`[AutoFill-Sync] Received ${records.length} records from ${apiKey}`);

  return res.status(200).json({
    accepted: records.length,
    rejected: 0,
    errors: []
  });
}
