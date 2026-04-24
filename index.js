const express = require('express');
const cors = require('cors');
const axios = require('axios');

const anilist = require('./src/metadata/anilist'); 
const mapper = require('./src/core/mapper');
const mangadex = require('./src/providers/mangadex');
const manganato = require('./src/providers/manganato');
const comick = require('./src/providers/comick'); // Make sure this is required!
const reader = require('./src/core/reader');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'ok', message: 'ManhwaHub V2 Core Running' }));

// 1. Metadata Routes
app.get('/api/home', async (req, res) => res.json(await anilist.getHomepage()));
app.get('/api/latest/:page', async (req, res) => res.json(await anilist.categoryFetch(req.params.page, 'latest')));
app.get('/api/all/:page', async (req, res) => res.json(await anilist.categoryFetch(req.params.page, 'popular')));
app.get('/api/trending/:page', async (req, res) => res.json(await anilist.categoryFetch(req.params.page, 'popular')));
app.get('/api/manhwa/:page', async (req, res) => res.json(await anilist.categoryFetch(req.params.page, 'popular', 'manhwa')));
app.get('/api/manhua/:page', async (req, res) => res.json(await anilist.categoryFetch(req.params.page, 'popular', 'manhua')));
app.get('/api/manga/:page', async (req, res) => res.json(await anilist.categoryFetch(req.params.page, 'popular', 'manga')));

app.get('/api/browse/:page', async (req, res) => {
  const filters = { type: req.query.type || '', status: req.query.status || '', sort: req.query.sort || 'popular', genre: req.query.genre || '' };
  res.json(await anilist.browse(req.params.page || 1, filters));
});

app.get('/api/search/:query', async (req, res) => res.json(await anilist.searchManga(req.params.query, req.query.page || 1)));
app.get('/api/search', async (req, res) => res.json(await anilist.searchManga(req.query.q || req.query.query || '', req.query.page || 1)));
app.get('/api/info/:id', async (req, res) => res.json(await anilist.getInfo(req.params.id)));

// 2. The Multi-Provider Chapter Fetcher (Upgraded Waterfall Logic)
app.get('/api/chapters/:anilistId', async (req, res) => {
  const anilistId = req.params.anilistId;
  const mappings = await mapper.getProviderIds(anilistId);
  
  let finalChapters =[];

  // Step 1: Try MangaDex First (Fastest & Lightest)
  if (mappings.mangadex) {
      finalChapters = await mangadex.getChapters(mappings.mangadex);
  }

  // Step 2: Did MangaDex fail or have missing chapters? (Less than 15)
  // If so, we trigger Manganato. We do NOT run them at the same time to save RAM.
  if (finalChapters.length < 15) {
      console.log(`[WATERFALL] MangaDex had ${finalChapters.length} chapters. Trying Manganato...`);
      let natoChapters =[];
      
      if (mappings.manganato) {
          natoChapters = await manganato.getChapters(mappings.manganato);
      } else {
          // If no MAL-Sync mapping, search dynamically!
          const info = await anilist.getInfo(anilistId);
          const searchTitle = info.alt_titles[0] || info.page;
          if (searchTitle) {
              natoChapters = await manganato.searchAndGetChapters(searchTitle);
          }
      }

      // If Manganato found MORE chapters, overwrite the list.
      if (natoChapters.length > finalChapters.length) {
          finalChapters = natoChapters;
      }
  }

  // Step 3: Did Manganato also fail? Try ComicK as the absolute last resort.
  if (finalChapters.length < 15 && mappings.comick) {
      console.log(`[WATERFALL] Manganato failed. Trying ComicK...`);
      const ckChapters = await comick.getChapters(mappings.comick);
      if (ckChapters.length > finalChapters.length) {
          finalChapters = ckChapters;
      }
  }

  // Final Cleanup: Sort strictly descending and add indexes
  finalChapters.sort((a, b) => parseFloat(b.chapter_number) - parseFloat(a.chapter_number));
  finalChapters.forEach((c, i) => c.chapter_index = i + 1);

  res.json({ 
    ch_list: finalChapters, 
    total_chapters: finalChapters.length, 
    source_used: finalChapters.length > 0 ? finalChapters[0].provider : 'None' 
  });
});

// 3. The Chapter Reader
app.get('/api/chapter/:slug', async (req, res) => res.json(await reader.getPages(req.params.slug)));

// 4. Image Proxy
app.get('/api/proxy/image', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) return res.status(400).send('No image URL provided');
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://manganato.com/' }
    });
    res.setHeader('Content-Type', response.headers['content-type']);
    res.setHeader('Cache-Control', 'public, max-age=86400'); 
    res.send(response.data);
  } catch (error) {
    res.status(500).send('Failed to load image');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ManhwaHub V2 running on port ${PORT}`));
