const cheerio = require('cheerio');
let gotScraping;

async function getChapters(manganatoUrl) {
  if (!manganatoUrl) return[];

  try {
    if (!gotScraping) {
      const module = await import('got-scraping');
      gotScraping = module.gotScraping;
    }

    const response = await gotScraping({
      url: manganatoUrl,
      headerGeneratorOptions: { browsers: [{ name: 'chrome', minVersion: 110 }] }
    });
    
    const $ = cheerio.load(response.body);
    const chapters =[];
    
    $('.row-content-chapter li.a-h').each((i, el) => {
      const aTag = $(el).find('a.chapter-name');
      const chTitle = aTag.text().trim();
      const chLink = aTag.attr('href');
      const numMatch = chTitle.match(/Chapter\s+([\d.]+)/i);
      const num = numMatch ? numMatch[1] : '0';
      
      if (chLink) {
        chapters.push({
          ch_title: `Chapter ${num} (Manganato)`,
          chapter_number: num,
          slug: `nato_${Buffer.from(chLink).toString('base64')}`,
          time: $(el).find('.chapter-time').text().trim(),
          provider: 'Manganato'
        });
      }
    });
    
    return chapters;
  } catch (err) {
    console.error("[MANGANATO] Error fetching chapters:", err.message);
    return[];
  }
}

module.exports = { getChapters };
