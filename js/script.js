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
        // A tiny speed bump to prevent the Jikan API from blocking us
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const suggestBtn = document.querySelector("#btn-suggest");

        suggestBtn?.addEventListener("click", async () => {
            const overlay = document.querySelector("#loading-overlay");
            overlay.style.display = "flex";

            try {
                const params = new URLSearchParams(window.location.search);
                const query = params.get("q");

                if (!query) {
                    alert("Search for an anime first.");
                    overlay.style.display = "none";
                    return;
                }

                const searchResults = await fetchFromJikan(`/anime?q=${query}&limit=1`);
                if (!searchResults || !searchResults.length) {
                    alert("Anime not found.");
                    overlay.style.display = "none";
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
                    overlay.style.display = "none";
                    return;
                }

                // Only take the top 3 tags to avoid angering the Jikan API
                const tagIds = baseTags.slice(0, 3);

                let candidates = [];
                for (const tid of tagIds) {
                    const batch = await fetchFromJikan(`/anime?genres=${tid}&order_by=members&sort=desc&limit=25`);
                    if (batch) candidates = candidates.concat(batch);

                    // Wait 800 milliseconds before the next loop so Jikan doesn't block us
                    await delay(800);
                }

                // Remove any duplicates (in case an anime shares multiple tags and got fetched twice)
                const uniqueCandidates = Array.from(new Map(candidates.map(a => [a.mal_id, a])).values());

                // 4️⃣ Score the candidates based on shared tags
                const scored = uniqueCandidates.map(anime => {
                    let matchScore = 0;

                    // +1 for Genres, +3 for Themes (Isekai, etc), +2 for Demographics
                    anime.genres?.forEach(g => { if (baseTags.includes(g.mal_id)) matchScore += 1; });
                    anime.themes?.forEach(t => { if (baseTags.includes(t.mal_id)) matchScore += 5; });
                    anime.demographics?.forEach(d => { if (baseTags.includes(d.mal_id)) matchScore += 2; });

                    return { ...anime, matchScore };
                }).sort((a, b) => b.matchScore - a.matchScore);

                // 5️⃣ Filter and Render
                let exclusions = [];
                try {
                    // Failsafe in case getExcludedIds isn't set up perfectly yet
                    if (typeof getExcludedIds === 'function') {
                        exclusions = getExcludedIds() || [];
                    }
                } catch (e) { console.warn("Exclusions skipped."); }

                const filtered = scored
                    .filter(a => a.mal_id !== baseAnime.mal_id)
                    .filter(a => !exclusions.includes(a.mal_id))
                    .filter(a => a.matchScore > 0);

                // BONUS: Print the math to the developer console so you can see it working!
                console.table(filtered.map(a => ({ Title: a.title, Score: a.matchScore })).slice(0, 15));

                renderAnimeCards(filtered.slice(0, 15));

            } catch (error) {
                console.error("Suggestion Engine Error:", error);
                alert("The API got a bit overwhelmed! Try clicking suggest again in a few seconds.");
            } finally {
                // Always hide the loading screen, even if it crashes
                overlay.style.display = "none";
            }
        });
    });
});