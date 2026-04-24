const express = require('express');
const cors = require('cors');
const axios = require('axios');

const anilist = require('./src/metadata/anilist'); 
const mapper = require('./src/core/mapper');
const mangadex = require('./src/providers/mangadex');
const manganato = require('./src/providers/manganato');
const reader = require('./src/core/reader');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'ok', message: 'ManhwaHub V2 Core Running' }));

// 1. Metadata Routes
app.get('/api/home', async (req, res) => res.json(await anilist.getHomepage()));
app.get('/api/search/:query', async (req, res) => res.json(await anilist.searchManga(req.params.query, req.query.page || 1)));
app.get('/api/search', async (req, res) => res.json(await anilist.searchManga(req.query.q || req.query.query || '', req.query.page || 1)));
app.get('/api/info/:id', async (req, res) => res.json(await anilist.getInfo(req.params.id)));

// 2. The Multi-Provider Chapter Fetcher
app.get('/api/chapters/:anilistId', async (req, res) => {
  const anilistId = req.params.anilistId;
  const mappings = await mapper.getProviderIds(anilistId);
  
  const [mdChapters, natoChapters] = await Promise.all([
    mangadex.getChapters(mappings.mangadex),
    manganato.getChapters(mappings.manganato)
  ]);

  let finalChapters =[];
  if (natoChapters.length > mdChapters.length + 10) {
    finalChapters = natoChapters; 
  } else if (mdChapters.length > 0) {
    finalChapters = mdChapters; 
  } else {
    finalChapters = natoChapters;
  }

  finalChapters.sort((a, b) => parseFloat(b.chapter_number) - parseFloat(a.chapter_number));
  finalChapters.forEach((c, i) => c.chapter_index = i + 1);

  res.json({ ch_list: finalChapters, total_chapters: finalChapters.length, source_used: finalChapters.length > 0 ? finalChapters[0].provider : 'None' });
});

// 3. The Chapter Reader
app.get('/api/chapter/:slug', async (req, res) => res.json(await reader.getPages(req.params.slug)));

// 4. Image Proxy (Bypasses Hotlink Protection)
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
