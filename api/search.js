export default async function handler(req, res) {
  // Set CORS headers so legacy clients and webviews never get blocked
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight browser options checks
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract search query from URL parameter (e.g., /api/search?q=minecraft)
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({
      error: 'Missing query parameter: q',
      example: '/api/search?q=hello+world'
    });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX;

  if (!apiKey || !cx) {
    return res.status(500).json({
      error: 'Server misconfiguration: GOOGLE_API_KEY or GOOGLE_CX environment variables are missing.'
    });
  }

  try {
    const googleEndpoint = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q)}`;
    const response = await fetch(googleEndpoint);
    const data = await response.json();

    // Check if Google returned an error (such as quota exceeded or invalid key)
    if (data.error) {
      return res.status(data.error.code || 500).json({
        error: data.error.message,
        details: data.error.errors
      });
    }

    // Format output into a clean, lightweight payload thet legacy Android apps can easily parse
    const items = (data.items || []).map(item => ({
      title: item.title,
      link: item.link,
      displayLink: item.displayLink,
      snippet: item.snippet
    }));

    return res.status(200).json({
      query: q,
      totalResults: data.searchInformation ? data.searchInformation.totalResults : '0',
      searchTime: data.searchInformation ? data.searchInformation.searchTime : 0,
      results: items
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Proxy request failed to reach Google API',
      message: error.message
    });
  }
}
