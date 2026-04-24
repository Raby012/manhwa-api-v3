const express = require('express');
const cors = require('cors');
const axios = require('axios');
const redis = require('redis'); // ADDED: The Redis Library

const anilist = require('./src/metadata/anilist'); 
const mapper = require('./src/core/mapper');
const mangadex = require('./src/providers/mangadex');
const manganato = require('./src/providers/manganato');
const comick = require('./src/providers/comick');
const reader = require('./src/core/reader');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// REDIS CLOUD CONNECTION
// ==========================================
let redisClient = null;

(async () => {
  // It looks for the REDIS_URL you saved in Render's Environment Variables
  if (process.env.REDIS_URL) {
    redisClient = redis.createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err) => console.log('Redis Client Error:', err));
    await redisClient.connect();
    console.log('✅ Connected to Redis Cloud Successfully!');
  } else {
    console.log('⚠️ No REDIS_URL found in Environment Variables. Running without Redis.');
  }
})();

// Helper function to check Cache before doing heavy scraping
async function checkCache(req, res, next) {
  if (!redisClient) return next(); // Skip if Redis isn't connected
  
  const key = req.originalUrl;
  try {
    const cachedData = await redisClient.get(key);
    if (cachedData) {
      console.log(`[CACHE HIT] Loaded ${key} instantly from Redis.`);
      return res.json(JSON.parse(cachedData));
    }
    next(); // If not in cache, continue to normal route
  } catch (err) {
    next();
  }
}

// Helper function to save to Cache
async function saveToCache(key, data, expirationInSeconds = 600) {
  if (redisClient) {
    await redisClient.setEx(key, expirationInSeconds, JSON.stringify(data));
  }
}

app.get('/', (req, res) => res.json({ status: 'ok', message: 'ManhwaHub V2 Core Running (with Redis)' }));

// ==========================================
// CACHED ROUTES
// Notice we added 'checkCache' to these routes!
// ==========================================
app.get('/api/home', checkCache, async (req, res) => {
  const data = await anilist.getHomepage();
  await saveToCache(req.originalUrl, data, 600); // Cache for 10 minutes
  res.json(data);
});

app.get('/api/latest/:page', checkCache, async (req, res) => {
  const data = await anilist.categoryFetch(req.params.page, 'latest');
  await saveToCache(req.originalUrl, data, 600);
  res.json(data);
});

app.get('/api/info/:id', checkCache, async (req, res) => {
  const data = await anilist.getInfo(req.params.id);
  await saveToCache(req.originalUrl, data, 86400); // Cache info for 24 hours
  res.json(data);
});

// The Heavy Multi-Provider Chapter Fetcher
app.get('/api/chapters/:anilistId', checkCache, async (req, res) => {
  const anilistId = req.params.anilistId;
  const mappings = await mapper.getProviderIds(anilistId);
  
  let finalChapters =[];

  if (mappings.mangadex) finalChapters = await mangadex.getChapters(mappings.mangadex);

  if (finalChapters.length < 15) {
      console.log(`[WATERFALL] MangaDex missing chapters. Trying Manganato...`);
      let natoChapters =[];
      if (mappings.manganato) {
          natoChapters = await manganato.getChapters(mappings.manganato);
      } else {
          const info = await anilist.getInfo(anilistId);
          const searchTitle = info.alt_titles[0] || info.page;
          if (searchTitle) natoChapters = await manganato.searchAndGetChapters(searchTitle);
      }
      if (natoChapters.length > finalChapters.length) finalChapters = natoChapters;
  }

  if (finalChapters.length < 15 && mappings.comick) {
      console.log(`[WATERFALL] Manganato failed. Trying ComicK...`);
      const ckChapters = await comick.getChapters(mappings.comick);
      if (ckChapters.length > finalChapters.length) finalChapters = ckChapters;
  }

  finalChapters.sort((a, b) => parseFloat(b.chapter_number) - parseFloat(a.chapter_number));
  finalChapters.forEach((c, i) => c.chapter_index = i + 1);

  const responseData = { ch_list: finalChapters, total_chapters: finalChapters.length, source_used: finalChapters.length > 0 ? finalChapters[0].provider : 'None' };
  
  // Cache the chapter list for 15 minutes
  await saveToCache(req.originalUrl, responseData, 900); 
  
  res.json(responseData);
});

// ==========================================
// UNCACHED ROUTES (Search & Reading)
// ==========================================
app.get('/api/search/:query', async (req, res) => res.json(await anilist.searchManga(req.params.query, req.query.page || 1)));
app.get('/api/search', async (req, res) => res.json(await anilist.searchManga(req.query.q || req.query.query || '', req.query.page || 1)));
app.get('/api/browse/:page', async (req, res) => {
  const filters = { type: req.query.type || '', status: req.query.status || '', sort: req.query.sort || 'popular', genre: req.query.genre || '' };
  res.json(await anilist.browse(req.params.page || 1, filters));
});
app.get('/api/chapter/:slug', async (req, res) => res.json(await reader.getPages(req.params.slug)));

// Image Proxy
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
