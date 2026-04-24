// ==============================
// COMICK FULL WORKING MODULE
// ==============================

let gotScraping;

// ------------------------------
// INIT CLIENT
// ------------------------------
async function getClient() {
  if (!gotScraping) {
    const module = await import('got-scraping');
    gotScraping = module.gotScraping;
  }
  return gotScraping;
}

// ------------------------------
// SAFE JSON PARSE
// ------------------------------
function safeParse(body) {
  try {
    return typeof body === "string" ? JSON.parse(body) : body;
  } catch {
    return null;
  }
}

// ------------------------------
// EXTRACT SLUG FROM URL
// ------------------------------
function extractSlug(url) {
  if (!url) return null;
  const parts = url.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

// ------------------------------
// SEARCH COMICK
// ------------------------------
async function searchComick(title) {
  try {
    const client = await getClient();

    const cleanTitle = title
      .replace(/[^a-zA-Z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanTitle) return null;

    const res = await client({
      url: `https://api.comick.io/v1.0/search?q=${encodeURIComponent(cleanTitle)}&limit=3&tachiyomi=true`,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });

    const data = safeParse(res.body);

    if (!Array.isArray(data) || data.length === 0) return null;

    return data[0]; // best match

  } catch (err) {
    console.error("[COMICK] search error:", err.message);
    return null;
  }
}

// ------------------------------
// GET CHAPTER LIST
// ------------------------------
async function getChaptersBySlug(slug) {
  try {
    const client = await getClient();

    if (!slug) return [];

    // 1. get comic info
    const infoRes = await client({
      url: `https://api.comick.io/comic/${slug}`,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });

    const info = safeParse(infoRes.body);
    const hid = info?.comic?.hid;

    if (!hid) return [];

    // 2. get chapters
    const chRes = await client({
      url: `https://api.comick.io/comic/${hid}/chapters?lang=en&limit=9999&tachiyomi=true`,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });

    const data = safeParse(chRes.body);
    const chapters = data?.chapters || [];

    return chapters.map((c) => ({
      ch_title: `Chapter ${c.chap || '0'}`,
      chapter_number: c.chap || '0',
      slug: `comick_${c.hid}`,
      time: c.created_at || '',
      provider: 'ComicK'
    }));

  } catch (err) {
    console.error("[COMICK] getChapters error:", err.message);
    return [];
  }
}

// ------------------------------
// GET CHAPTER PAGES (READER)
// ------------------------------
async function getChapterPages(chapterHid) {
  try {
    const client = await getClient();

    if (!chapterHid) return [];

    const res = await client({
      url: `https://api.comick.io/chapter/${chapterHid}`,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });

    const data = safeParse(res.body);
    const pages = data?.chapter?.md_images || [];

    return pages.map((img) => ({
      img: `https://meo.comick.pictures/${img.b2key}`
    }));

  } catch (err) {
    console.error("[COMICK] pages error:", err.message);
    return [];
  }
}

// ------------------------------
// MAIN SEARCH + CHAPTER FETCH
// ------------------------------
async function searchAndGetChapters(title) {
  try {
    const result = await searchComick(title);
    if (!result) return [];

    const slug = result.slug;
    return await getChaptersBySlug(slug);

  } catch (err) {
    console.error("[COMICK] searchAndGet error:", err.message);
    return [];
  }
}

// ==============================
// EXPORT
// ==============================
module.exports = {
  searchAndGetChapters,
  getChaptersBySlug,
  getChapterPages
};
