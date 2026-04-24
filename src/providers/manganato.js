async function searchAndGetChapters(title) {
  try {
    if (!gotScraping) { const module = await import('got-scraping'); gotScraping = module.gotScraping; }
    const words = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/);
    const query = words.slice(0, 3).join('_');
    if (!query) return[];

    let searchUrl = `https://manganato.com/search/story/${query}`;
    let res = await gotScraping({ url: searchUrl, headerGeneratorOptions: { browsers:[{ name: 'chrome', minVersion: 110 }] } });
    let $ = cheerio.load(res.body);
    
    let mangaLink = null;
    if ($('.panel-story-info').length > 0) mangaLink = res.url;
    else mangaLink = $('.search-story-item a.item-title').first().attr('href');

    if (!mangaLink) return[];
    return await getChapters(mangaLink);
  } catch (e) {
    return[];
  }
}

// Make sure to export it at the bottom!
module.exports = { getChapters, searchAndGetChapters };
