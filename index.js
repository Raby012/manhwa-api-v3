const express = require('express');
const cors = require('cors');
const anilist = require('./src/metadata/anilist'); 
// Note: We will add the chapter providers in the next phase!

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'ok', message: 'ManhwaHub V2 Core Running' }));

// ==========================================
// METADATA ROUTES (Powered by AniList)
// ==========================================
app.get('/api/home', async (req, res) => res.json(await anilist.getHomepage()));

app.get('/api/search/:query', async (req, res) => {
  res.json(await anilist.searchManga(req.params.query, req.query.page || 1));
});
app.get('/api/search', async (req, res) => {
  const q = req.query.q || req.query.query || '';
  res.json(await anilist.searchManga(q, req.query.page || 1));
});

app.get('/api/info/:id', async (req, res) => res.json(await anilist.getInfo(req.params.id)));

// ==========================================
// TEMPORARY PLACEHOLDERS FOR PHASE 2
// ==========================================
// We will build the Multi-Provider Chapter Fetcher next!
const express = require('express');
const cors = require('cors');
const anilist = require('./src/metadata/anilist'); 
const mapper = require('./src/core/mapper');
const mangadex = require('./src/providers/mangadex');
const manganato = require('./src/providers/manganato');

const app = express();
app.use(cors());
app.use(express.json());

// ... (Keep your existing metadata routes from the previous phase) ...

// ==========================================
// THE MULTI-PROVIDER CHAPTER FETCHER
// ==========================================
app.get('/api/chapters/:anilistId', async (req, res) => {
  const anilistId = req.params.anilistId;
  
  // 1. Ask the Mapper for the exact URLs/IDs
  const mappings = await mapper.getProviderIds(anilistId);
  
  // 2. Fetch from all providers AT THE SAME TIME (Super Fast)
  const[mdChapters, natoChapters] = await Promise.all([
    mangadex.getChapters(mappings.mangadex),
    manganato.getChapters(mappings.manganato)
  ]);

  // 3. The Merge Logic
  // We prioritize Manganato if it has significantly more chapters (e.g., ORV missing chapters)
  let finalChapters =[];
  
  if (natoChapters.length > mdChapters.length + 10) {
    finalChapters = natoChapters; // Manganato wins (Bypasses DMCA)
  } else if (mdChapters.length > 0) {
    finalChapters = mdChapters; // MangaDex wins (Better quality/cleaner data)
  } else {
    finalChapters = natoChapters; // Fallback
  }

  // 4. Sort strictly descending
  finalChapters.sort((a, b) => parseFloat(b.chapter_number) - parseFloat(a.chapter_number));
  
  // Add correct indexes
  finalChapters.forEach((c, i) => c.chapter_index = i + 1);

  res.json({
    ch_list: finalChapters,
    total_chapters: finalChapters.length,
    source_used: finalChapters.length > 0 ? finalChapters[0].provider : 'None'
  });
});

// ... (Keep your Image Proxy from the previous phase) ...

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ManhwaHub V2 running on port ${PORT}`));
