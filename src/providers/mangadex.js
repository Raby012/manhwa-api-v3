const axios = require('axios');
const BASE = 'https://api.mangadex.org';

async function getChapters(mangaDexId) {
  if (!mangaDexId) return [];
  
  try {
    let allChapters =[];
    let offset = 0;
    const limit = 500;
    let total = Infinity;

    while (offset < total) {
      const res = await axios.get(`${BASE}/manga/${mangaDexId}/feed`, {
        params: { limit, offset, translatedLanguage: ['en'], contentRating: ['safe', 'suggestive', 'erotica', 'pornographic'], order: { chapter: 'desc' } }
      });
      total = res.data.total || 0;
      const fetched = res.data.data ||[];
      if (!fetched.length) break;
      allChapters = allChapters.concat(fetched);
      offset += limit;
    }

    const seen = new Map();
    allChapters.forEach(c => {
      let numStr = c.attributes.chapter || '0';
      const num = parseFloat(numStr);
      const key = isNaN(num) ? c.id : numStr;
      
      const existing = seen.get(key);
      const newTime = new Date(c.attributes.publishAt || 0).getTime();
      const oldTime = existing ? new Date(existing.attributes.publishAt || 0).getTime() : 0;
      if (!existing || newTime > oldTime) seen.set(key, c);
    });

    return Array.from(seen.values()).map(c => ({
      ch_title: `Chapter ${c.attributes.chapter || '0'} (MangaDex)`,
      chapter_number: c.attributes.chapter || '0',
      slug: `mangadex_${c.id}`, // We prefix it so we know which provider to use for images
      time: c.attributes.publishAt || '',
      provider: 'MangaDex'
    }));
  } catch (e) {
    console.error("[MANGADEX] Error fetching chapters:", e.message);
    return[];
  }
}

module.exports = { getChapters };
