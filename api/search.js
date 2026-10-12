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

  try {
    // Fetch DuckDuckGo HTML Lite (no bot-blocking, super fast, no API key needed)
    const targetUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html'
      }
    });

    const html = await response.text();

    // Parse links, titles, and snippets with regex (no bulky npm packages required)
    const results = [];
    const regex = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
    const titleRegex = /<a class="result__snippet[^>]*>[\s\S]*?<\/a>/;

    // Fast parser for results
    const blocks = html.split('<div class="result results_links');
    for (let i = 1; i < blocks.length && results.length < 10; i++) {
      const block = blocks[i];

      // Extract title and actual link
      const linkMatch = block.match(/<a class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

      if (linkMatch) {
        let cleanUrl = linkMatch[1];
        // Decode DDG redirect url if present
        const uddgMatch = cleanUrl.match(/uddg=([^&]+)/);
        if (uddgMatch) {
          cleanUrl = decodeURIComponent(uddgMatch[1]);
        }

        const cleanTitle = linkMatch[2].replace(/<[^>]+>/g, '').trim();
        const cleanSnippet = snippetMatch
          ? snippetMatch[1].replace(/<[^>]+>/g, '').trim()
          : '';

        results.push({
          title: cleanTitle,
          link: cleanUrl,
          snippet: cleanSnippet
        });
      }
    }

    return res.status(200).json({
      query: q,
      totalResults: results.length,
      results
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Proxy search failed',
      message: error.message
    });
  }
}
