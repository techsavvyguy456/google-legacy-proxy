export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Missing query parameter: q' });
  }

  // List of high-availability public SearXNG instances
  const instances = [
    'https://searx.be/search',
    'https://search.ononoki.org/search',
    'https://searx.priv.pw/search',
    'https://search.sapti.me/search'
  ];

  for (const baseUrl of instances) {
    try {
      const url = `${baseUrl}?q=${encodeURIComponent(q)}&format=json&categories=general`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) continue;

      const data = await response.json();

      if (data && Array.isArray(data.results) && data.results.length > 0) {
        const cleanResults = data.results.slice(0, 15).map(item => ({
          title: item.title || '',
          link: item.url || '',
          snippet: item.content || item.snippet || ''
        }));

        return res.status(200).json({
          query: q,
          totalResults: cleanResults.length,
          results: cleanResults
        });
      }
    } catch (err) {
      // If one instance fails or times out, loop tries the next one
      continue;
    }
  }

  // Backup fallback: Google Suggest queries if meta-engines are temporarily unreachable
  try {
    const suggestUrl = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`;
    const suggestRes = await fetch(suggestUrl);
    const suggestData = await suggestRes.json();
    const suggestions = (suggestData[1] || []).map(s => ({
      title: s,
      link: `https://www.google.com/search?q=${encodeURIComponent(s)}`,
      snippet: `Search Google for "${s}"`
    }));

    return res.status(200).json({
      query: q,
      totalResults: suggestions.length,
      results: suggestions
    });
  } catch (finalErr) {
    return res.status(500).json({
      error: 'All search upstream providers failed',
      details: finalErr.message
    });
  }
}
