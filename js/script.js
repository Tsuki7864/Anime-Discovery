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
            <h3>${anime.title}</h3>
            <p>${anime.episodes || "Ongoing"} Episodes</p>
            ${anime.matchScore !== undefined ? 
                `<p><strong>Match Score: ${anime.matchScore}</strong></p>` : ""
            }
            <div class="card-buttons">
                <button class="btn-watched">Watched</button>
                <button class="btn-want">Want</button>
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

        const candidates = await fetchFromJikan("/top/anime?limit=25");
        const scored = calculateRecommendations(candidates);

        const exclusions = getExcludedIds();
        const filtered = scored.filter(a => !exclusions.includes(a.mal_id));

        renderAnimeCards(filtered.slice(0, 15));

        overlay.style.display = "none";
    });
});