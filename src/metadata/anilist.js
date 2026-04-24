const axios = require('axios');

const ANILIST_URL = 'https://graphql.anilist.co';

// GraphQL Queries
const homepageQuery = `
query {
  trending: Page(page: 1, perPage: 20) {
    media(type: MANGA, sort: TRENDING_DESC) { id title { romaji english } coverImage { extraLarge } format status format countryOfOrigin }
  }
  popular: Page(page: 1, perPage: 20) {
    media(type: MANGA, sort: POPULAR_DESC) { id title { romaji english } coverImage { extraLarge } format status countryOfOrigin }
  }
  manhwa: Page(page: 1, perPage: 20) {
    media(type: MANGA, sort: TRENDING_DESC, countryOfOrigin: "KR") { id title { romaji english } coverImage { extraLarge } format status }
  }
}`;

const searchQuery = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total currentPage hasNextPage }
    media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
      id title { romaji english } coverImage { extraLarge } format status countryOfOrigin
    }
  }
}`;

// Helper to format AniList data for your frontend
function formatMedia(m) {
  return {
    id: m.id, // The ultimate Unified ID
    title: m.title.english || m.title.romaji || 'Unknown',
    image: m.coverImage.extraLarge,
    type: m.countryOfOrigin === 'KR' ? 'manhwa' : m.countryOfOrigin === 'CN' ? 'manhua' : 'manga',
    status: m.status || 'UNKNOWN'
  };
}

async function getHomepage() {
  try {
    const response = await axios.post(ANILIST_URL, { query: homepageQuery });
    const data = response.data.data;
    return {
      trending: data.trending.media.map(formatMedia),
      popular: data.popular.media.map(formatMedia),
      top_manhwa: data.manhwa.media.map(formatMedia)
    };
  } catch (error) {
    console.error("AniList Homepage Error:", error);
    return { trending: [], popular: [], top_manhwa:[] };
  }
}

async function searchManga(query, page = 1) {
  try {
    const response = await axios.post(ANILIST_URL, {
      query: searchQuery,
      variables: { search: query, page: parseInt(page), perPage: 24 }
    });
    const data = response.data.data.Page;
    return {
      list: data.media.map(formatMedia),
      current_page: data.pageInfo.currentPage,
      has_next: data.pageInfo.hasNextPage,
      total: data.pageInfo.total
    };
  } catch (error) {
    console.error("AniList Search Error:", error);
    return { list:
