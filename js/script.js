import {
    addToWatched,
    addToWantList,
    getGenrePreferences,
    getLengthPreferences,
    getExcludedIds
} from './profileManager.js';

const BASE_URL = "https://api.jikan.moe/v4";

async function fetchFromJikan(endpoint) {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`);
        if (!response.ok) throw new Error("API Error");
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error(error);
        return [];
    }
}

function calculateRecommendations(candidates) {
    const genrePrefs = getGenrePreferences();
    const lengthPrefs = getLengthPreferences();

    return candidates.map(anime => {
        let score = 0;

        anime.genres?.forEach(g => {
            if (genrePrefs[g.name]) {
                score += genrePrefs[g.name];
            }
        });

        const ep = anime.episodes || 0;
        let category = "unknown";

        if (ep > 0 && ep <= 13) category = "short";
        else if (ep <= 26) category = "medium";
        else if (ep > 26) category = "long";

        if (lengthPrefs[category]) {
            score += lengthPrefs[category] * 1.5;
        }

        return { ...anime, matchScore: Math.round(score) };
    }).sort((a, b) => b.matchScore - a.matchScore);
}

function renderAnimeCards(animeList) {
    const grid = document.querySelector('#anime-grid');
    grid.innerHTML = '';

    if (!animeList.length) {
        grid.innerHTML = "<p>No results found.</p>";
        return;
    }

    animeList.forEach(anime => {
        const card = document.createElement('div');
        card.className = "anime-card";

        const img = anime.images?.jpg?.image_url || 
        "https://via.placeholder.com/225x318?text=No+Image";

        card.innerHTML = `
    <img src="${img}" alt="${anime.title}">
    <div class="anime-overlay">
        <h3>${anime.title}</h3>
        <p>${anime.synopsis ? anime.synopsis.substring(0, 200) + "..." : "No description available."}</p>
    </div>
`;

        grid.appendChild(card);
    });
}

document.addEventListener("DOMContentLoaded", async () => {

    const overlay = document.querySelector("#loading-overlay");

    const params = new URLSearchParams(window.location.search);
    const query = params.get("q");

    if (query) {
        overlay.style.display = "flex";
        const results = await fetchFromJikan(`/anime?q=${query}&limit=12`);
        renderAnimeCards(results);
        overlay.style.display = "none";
    }

    const suggestBtn = document.querySelector("#btn-suggest");

suggestBtn?.addEventListener("click", async () => {

    overlay.style.display = "flex";

    const params = new URLSearchParams(window.location.search);
    const query = params.get("q");

    if (!query) {
        alert("Search for an anime first.");
        overlay.style.display = "none";
        return;
    }

    // 1️⃣ Get the anime the user searched
    const searchResults = await fetchFromJikan(`/anime?q=${query}&limit=1`);
    if (!searchResults.length) {
        alert("Anime not found.");
        overlay.style.display = "none";
        return;
    }

    const baseAnime = searchResults[0];
    const baseGenres = baseAnime.genres.map(g => g.mal_id);

    if (!baseGenres.length) {
        overlay.style.display = "none";
        return;
    }

    /// 2️⃣ Fetch candidates from multiple genres (more reliable than 1 genre)
const genreIds = baseGenres.slice(0, 3); // take up to 3 genres

let candidates = [];
for (const gid of genreIds) {
    // NEW: We added order_by=members and sort=desc
    const batch = await fetchFromJikan(`/anime?genres=${gid}&order_by=members&sort=desc&limit=25`);
    candidates = candidates.concat(batch);
}

// Fallback if genre search returns nothing
if (!candidates.length) {
    candidates = await fetchFromJikan(`/top/anime?filter=bypopularity&limit=50`);
}

    // 3️⃣ Score by shared genres
    const scored = candidates.map(anime => {

        let matchCount = 0;

        anime.genres?.forEach(g => {
            if (baseGenres.includes(g.mal_id)) {
                matchCount++;
            }
        });

        return {
            ...anime,
            matchScore: matchCount
        };

    }).sort((a, b) => b.matchScore - a.matchScore);

    const exclusions = getExcludedIds();

let filtered = scored
    .filter(a => a.mal_id !== baseAnime.mal_id)
    .filter(a => !exclusions.includes(a.mal_id));

// If everything got filtered out, show the best scored anyway (except baseAnime)
if (!filtered.length) {
    filtered = scored.filter(a => a.mal_id !== baseAnime.mal_id);
}

renderAnimeCards(filtered.slice(0, 15));
    overlay.style.display = "none";
});
});