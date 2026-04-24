const axios = require('axios');

// We use the MAL-Sync API to instantly map AniList IDs to MangaDex/Manganato IDs
const MALSYNC_URL = 'https://api.malsync.moe/manga/anilist';

async function getProviderIds(anilistId) {
  try {
    const response = await axios.get(`${MALSYNC_URL}/${anilistId}`);
    const sites = response.data.Sites || {};

    let mappings = {
      mangadex: null,
      manganato: null
    };

    // 1. Check for MangaDex ID
    if (sites.Mangadex) {
      const mdKeys = Object.keys(sites.Mangadex);
      if (mdKeys.length > 0) mappings.mangadex = mdKeys[0]; // e.g., '801513ba...'
    }

    // 2. Check for Manganato ID
    if (sites.Manganato) {
      const natoKeys = Object.keys(sites.Manganato);
      if (natoKeys.length > 0) mappings.manganato = sites.Manganato[natoKeys[0]].url; // e.g., 'https://manganato.com/manga-lu988903'
    }

    return mappings;
  } catch (error) {
    // If MAL-Sync fails or doesn't have the manga, we return nulls
    console.error(`[MAPPER] Failed to map AniList ID ${anilistId}`);
    return { mangadex: null, manganato: null };
  }
}

module.exports = { getProviderIds };
