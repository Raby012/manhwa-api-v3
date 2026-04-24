const axios = require('axios');

const BASE = 'https://api.mangadex.org';
const headers = {
  'Accept': 'application/json',
  'User-Agent': 'ManhwaHub-V3-Render'
};

// ==============================
// FORMAT MANGA
// ==============================
function buildManga(m) {
  const cover = m.relationships?.find(r => r.type === 'cover_art');
  const author = m.relationships?.find(r => r.type === 'author');
  const fileName = cover?.attributes?.fileName || '';
  const lang = m.attributes.originalLanguage;

  const titleObj = m.attributes.title || {};
  const altTitles = m.attributes.altTitles || [];

  let enAltTitle = null;
  for (let alt of altTitles) {
    if (alt.en) { enAltTitle = alt.en; break; }
  }

  const title = enAltTitle || titleObj.en || Object.values(titleObj)[0] || 'Unknown';

  return {
    slug: m.id,
    title,
    image: fileName
      ? `https://uploads.mangadex.org/covers/${m.id}/${fileName}.256.jpg`
      : null,
    type: lang === 'ko' ? 'manhwa' :
          (lang === 'zh' || lang === 'zh-hk') ? 'manhua' : 'manga',
    status: m.attributes.status || 'UNKNOWN'
  };
}

// ==============================
// FETCH LISTS
// ==============================
async function fetchManga(page, order = { updatedAt: 'desc' }, extraParams = {}) {
  const limit = 30;
  const offset = (parseInt(page) - 1) * limit;

  try {
    const res = await axios.get(`${BASE}/manga`, {
      headers,
      params: {
        limit,
        offset,
        originalLanguage: ['ko', 'ja', 'zh', 'zh-hk'],
        order,
        includes: ['cover_art', 'author'],
        availableTranslatedLanguage: ['en'],
        contentRating: ['safe', 'suggestive'],
        ...extraParams,
      }
    });

    return {
      list: res.data.data.map(buildManga),
      current_page: parseInt(page),
      total: res.data.total,
      total_pages: Math.ceil(res.data.total / limit),
    };

  } catch (e) {
    console.error("Metadata Fetch Error:", e.message);
    return { list: [], total: 0, current_page: page };
  }
}

// ==============================
// HOMEPAGE
// ==============================
async function getHomepage() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
      .toISOString().split('.')[0];

    const [trendingRes, popularRes, newRes] = await Promise.all([
      fetchManga(1, { followedCount: 'desc' }, { createdAtSince: thirtyDaysAgo }),
      fetchManga(1, { followedCount: 'desc' }),
      fetchManga(1, { createdAt: 'desc' }, { originalLanguage: ['ko'] })
    ]);

    return {
      trending: trendingRes.list,
      popular: popularRes.list,
      latest: popularRes.list,
      new_arrivals: newRes.list
    };

  } catch {
    return { trending: [], popular: [], latest: [], new_arrivals: [] };
  }
}

// ==============================
// SEARCH
// ==============================
async function searchManga(query, page = 1) {
  if (!query) return { list: [], total: 0, current_page: page };

  const limit = 24;
  const offset = (parseInt(page) - 1) * limit;

  try {
    const res = await axios.get(`${BASE}/manga`, {
      headers,
      params: {
        title: query,
        limit,
        offset,
        includes: ['cover_art', 'author'],
        availableTranslatedLanguage: ['en'],
        order: { relevance: 'desc' }
      }
    });

    return {
      list: res.data.data.map(buildManga),
      total: res.data.total,
      current_page: parseInt(page)
    };

  } catch {
    return { list: [], total: 0, current_page: page };
  }
}

// ==============================
// FULL INFO + CHAPTERS (FIXED)
// ==============================
async function getInfo(id) {
  try {
    // 1. metadata
    const res = await axios.get(`${BASE}/manga/${id}`, {
      headers,
      params: { includes: ['cover_art', 'author', 'artist'] }
    });

    const m = res.data.data;

    const cover = m.relationships.find(r => r.type === 'cover_art');
    const author = m.relationships.find(r => r.type === 'author');
    const fileName = cover?.attributes?.fileName || '';

    const titleObj = m.attributes.title || {};
    const altTitles = m.attributes.altTitles || [];

    let enAltTitle = '';
    for (let alt of altTitles) {
      if (alt.en) { enAltTitle = alt.en; break; }
    }

    const title =
      enAltTitle || titleObj.en || Object.values(titleObj)[0] || 'Unknown';

    // ============================
    // 2. FETCH CHAPTERS (FIX)
    // ============================

    let allChapters = [];
    let offset = 0;
    const limit = 500;
    let total = Infinity;

    while (offset < total) {
      const chRes = await axios.get(`${BASE}/manga/${id}/feed`, {
        headers,
        params: {
          limit,
          offset,
          translatedLanguage: ['en'],
          order: { chapter: 'asc' },
          contentRating: ['safe', 'suggestive', 'erotica']
        }
      });

      total = chRes.data.total;
      const data = chRes.data.data;

      if (!data.length) break;

      allChapters.push(...data);
      offset += limit;
    }

    // remove duplicates
    const seen = new Map();
    allChapters.forEach(c => {
      const num = c.attributes.chapter;
      if (!num) return;
      if (!seen.has(num)) seen.set(num, c);
    });

    const ch_list = Array.from(seen.values())
      .sort((a, b) =>
        parseFloat(a.attributes.chapter) - parseFloat(b.attributes.chapter)
      )
      .map(c => ({
        ch_title: `Chapter ${c.attributes.chapter}`,
        chapter_number: c.attributes.chapter,
        slug: `md_${c.id}`,
        time: c.attributes.publishAt || '',
        provider: 'MangaDex'
      }));

    return {
      slug: m.id,
      page: title,
      poster: fileName
        ? `https://uploads.mangadex.org/covers/${id}/${fileName}.512.jpg`
        : null,
      description: m.attributes.description?.en || 'No description available',
      status: m.attributes.status || 'UNKNOWN',
      type:
        m.attributes.originalLanguage === 'ko' ? 'manhwa' :
        m.attributes.originalLanguage === 'zh' ? 'manhua' : 'manga',
      authors: author?.attributes?.name || 'Unknown',
      year: m.attributes.year || '',
      genres: (m.attributes.tags || [])
        .filter(t => t.attributes.group === 'genre')
        .map(t => t.attributes.name.en || ''),
      ch_list
    };

  } catch (e) {
    console.error("getInfo Error:", e.message);
    return null;
  }
}

// ==============================
// CHAPTER PAGES (READER FIX)
// ==============================
async function getChapterPages(chapterId) {
  try {
    const res = await axios.get(`${BASE}/at-home/server/${chapterId}`);

    const baseUrl = res.data.baseUrl;
    const chapter = res.data.chapter;

    return chapter.data.map(file => ({
      img: `${baseUrl}/data/${chapter.hash}/${file}`
    }));

  } catch (e) {
    console.error("Pages Error:", e.message);
    return [];
  }
}

// ==============================
// EXPORT
// ==============================
module.exports = {
  getHomepage,
  searchManga,
  fetchManga,
  getInfo,
  getChapterPages
};
