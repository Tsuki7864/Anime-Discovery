import {
    addToWatched,
    addToWantList,
    getGenrePreferences,
    getLengthPreferences,
    getExcludedIds
} from './profileManager.js';

const BASE_URL = "https://api.jikan.moe/v4";

// A tiny speed bump to prevent the Jikan API from blocking us
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
        
        // FIXED: Added anime.synopsis and a fallback if it's blank
        const description = anime.synopsis ? anime.synopsis.substring(0, 150) + "..." : "No description available.";

        card.innerHTML = `
            <img src="${img}" alt="${anime.title}">
            <div class="anime-overlay">
                <h3>${anime.title}</h3>
                <p>${description}</p>

                <div class="overlay-buttons">
                    <button class="btn-watched">Watched</button>
                    <button class="btn-want">Want</button>
                </div>
            </div>
        `;

        grid.appendChild(card);
    });
}

document.addEventListener("DOMContentLoaded", async () => {

    const overlay = document.querySelector("#loading-overlay");
    const params = new URLSearchParams(window.location.search);
    const query = params.get("q");

    // Initial search on page load
    if (query) {
        if (overlay) overlay.style.display = "flex";
        const results = await fetchFromJikan(`/anime?q=${query}&limit=12`);
        renderAnimeCards(results);
        if (overlay) overlay.style.display = "none";
    }

    const suggestBtn = document.querySelector("#btn-suggest");

    // FIXED: Only one event listener, and 'event' is properly passed in!
    suggestBtn?.addEventListener("click", async (event) => {
        
        // --- STEP 1: THE BUTTON LOCK ---
        const btn = event.currentTarget;
        if (btn.disabled) return; 
        
        btn.disabled = true;
        btn.innerText = "Calculating...";
        btn.style.opacity = "0.7"; 
        btn.style.cursor = "not-allowed";

        if (overlay) overlay.style.display = "flex";

        try {
            const params = new URLSearchParams(window.location.search);
            const query = params.get("q");

            if (!query) {
                alert("Search for an anime first.");
                return;
            }

            const searchResults = await fetchFromJikan(`/anime?q=${query}&limit=1`);
            if (!searchResults || !searchResults.length) {
                alert("Anime not found.");
                return;
            }

            const baseAnime = searchResults[0];

            const baseTags = [
                ...(baseAnime.genres || []),
                ...(baseAnime.themes || []),
                ...(baseAnime.demographics || [])
            ].map(tag => tag.mal_id);

            if (!baseTags.length) {
                alert("This anime has no tags on MAL to match against!");
                return;
            }

            const tagIds = baseTags.slice(0, 3);

            let candidates = [];
            for (const tid of tagIds) {
                const batch = await fetchFromJikan(`/anime?genres=${tid}&order_by=members&sort=desc&limit=25`);
                if (batch) candidates = candidates.concat(batch);

                await delay(800);
            }

            const uniqueCandidates = Array.from(new Map(candidates.map(a => [a.mal_id, a])).values());

            const scored = uniqueCandidates.map(anime => {
                let matchScore = 0;

                anime.genres?.forEach(g => { if (baseTags.includes(g.mal_id)) matchScore += 3; });
                anime.themes?.forEach(t => { if (baseTags.includes(t.mal_id)) matchScore += 6; });
                anime.demographics?.forEach(d => { if (baseTags.includes(d.mal_id)) matchScore += 1; });

                return { ...anime, matchScore };
            }).sort((a, b) => b.matchScore - a.matchScore);

            let exclusions = [];
            try {
                if (typeof getExcludedIds === 'function') {
                    exclusions = getExcludedIds() || [];
                }
            } catch (e) { console.warn("Exclusions skipped."); }

            const filtered = scored
                .filter(a => a.mal_id !== baseAnime.mal_id)
                .filter(a => !exclusions.includes(a.mal_id))
                .filter(a => a.matchScore > 0);

            console.table(filtered.map(a => ({ Title: a.title, Score: a.matchScore })).slice(0, 15));

            renderAnimeCards(filtered.slice(0, 15));

        } catch (error) {
            console.error("Suggestion Engine Error:", error);
            alert("The API got a bit overwhelmed! Try clicking suggest again in a few seconds.");
        } finally {
            if (overlay) overlay.style.display = "none";
            btn.disabled = false;
            btn.innerText = "Suggest";
            btn.style.opacity = "1";
            btn.style.cursor = "pointer";
        }
    });
});