const axios = require('axios');
const cheerio = require('cheerio');
let gotScraping;

async function getPages(chapterSlug) {
  if (chapterSlug.startsWith('nato_')) {
    try {
      const link = Buffer.from(chapterSlug.replace('nato_', ''), 'base64').toString('utf-8');
      if (!gotScraping) { const module = await import('got-scraping'); gotScraping = module.gotScraping; }
      const res = await gotScraping({ url: link, headerGeneratorOptions: { browsers: [{ name: 'chrome', minVersion: 110 }] } });
      const $ = cheerio.load(res.body); const pages =[];
      $('.container-chapter-reader img').each((i, el) => {
        const src = $(el).attr('src'); if (src) pages.push({ ch: src, index: i + 1, total: 0 });
      });
      pages.forEach(p => p.total = pages.length);
      return { chapter_id: chapterSlug, total_pages: pages.length, chapters: pages };
    } catch (e) { return { error: e.message, chapters:[] }; }
  }

  if (chapterSlug.startsWith('mangadex_')) {
    try {
      const id = chapterSlug.replace('mangadex_', '');
      const res = await axios.get(`https://api.mangadex.org/at-home/server/${id}`);
      const { baseUrl, chapter: ch } = res.data;
      const pages = (ch.data ||[]).map((f, i) => ({ ch: `${baseUrl}/data/${ch.hash}/${f}`, index: i + 1, total: ch.data.length }));
      return { chapter_id: chapterSlug, total_pages: pages.length, chapters: pages };
    } catch (e) { return { error: e.message, chapters:[] }; }
  }
  return { error: "Invalid provider", chapters:[] };
}
module.exports = { getPages };
