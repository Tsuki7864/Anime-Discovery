import {
    addToWatched,
    addToWantList,
    getGenrePreferences,
    getLengthPreferences,
    getExcludedIds
} from './profileManager.js';

const BASE_URL = "https://api.jikan.moe/v4";

// A tiny speed bump to prevent the Jikan API from blocking us
// A tiny speed bump to prevent the Jikan API from blocking us
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// THE NEW BULLETPROOF FETCH
async function fetchFromJikan(endpoint, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(`${BASE_URL}${endpoint}`);

            // If the API is overwhelmed (429 Rate Limit or 500+ Server Error)
            if (response.status === 429 || response.status >= 500) {
                console.warn(`Jikan is overwhelmed (Error ${response.status}). Retrying in ${i + 1} seconds...`);
                await delay((i + 1) * 1000); // Wait 1s, then 2s, then 3s
                continue; // Skip the rest of this loop and try the fetch again!
            }

            // If it's a normal error (like a 404 Not Found), just throw it
            if (!response.ok) throw new Error(`API Error: ${response.status}`);

            // If we made it here, it was a success!
            const data = await response.json();
            return data.data;

        } catch (error) {
            // If it's the very last try, give up and log the error
            if (i === retries - 1) {
                console.error("Max retries reached. The API is totally down:", error);
                return [];
            }
            // Otherwise, wait 1 second and try again (for general network hiccups)
            await delay(6000);
        }
    }
    return []; // Fallback empty array just in case
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
    <button class="btn-watched" data-id="${anime.mal_id}">Watched</button>
    <button class="btn-want" data-id="${anime.mal_id}">Want</button>
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
    document.querySelector("#btn-reset")?.addEventListener("click", () => {
        if (confirm("Are you sure you want to delete your Watched list and Profile scores?")) {
            localStorage.clear(); // Wipes the slate clean
            alert("Memory wiped. You are a blank slate!");
            window.location.reload(); // Refreshes the page to apply changes
        }
    });

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

            const baseThemes = (baseAnime.themes || []).map(tag => tag.mal_id);
            const baseGenres = (baseAnime.genres || []).map(tag => tag.mal_id);
            const baseDemos = (baseAnime.demographics || []).map(tag => tag.mal_id);

            // Combine them, but Themes go first so the API fetches them first
            const baseTags = [...baseThemes, ...baseGenres, ...baseDemos];
            const primaryTag = baseTags.length > 0 ? baseTags[0] : null;

            let uniqueCandidates = [];

            if (primaryTag) {
                console.log(`1. Requesting primary tag: ${primaryTag} to cast a wide net`);

                // Fetch 75 popular shows from that one main genre
                const response = await fetchFromJikan(`/anime?genres=${primaryTag}&order_by=members&sort=desc&limit=75`);
                uniqueCandidates = response || [];
            }

            console.log("2. API returned candidates:", uniqueCandidates.length);

            // --- BIAS CHECK ---
            let candidatesToScore = uniqueCandidates;

            const userPrefs = getGenrePreferences() || {};
            let topFavoriteGenre = null;
            let highestPrefScore = 0;

            // 2. Find the genre with the highest score
            for (const [genreName, score] of Object.entries(userPrefs)) {
                if (score > highestPrefScore) {
                    highestPrefScore = score;
                    topFavoriteGenre = genreName;
                }
            }

            // This is the "New" If Statement
            if (topFavoriteGenre && highestPrefScore >= 3) {
                const biasedResults = uniqueCandidates.filter(anime => {
                    return anime.genres?.some(g => g.name === topFavoriteGenre);
                });

                // Only apply the filter if it doesn't leave us with 0 results
                if (biasedResults.length > 0) {
                    candidatesToScore = biasedResults;
                }
            }
            console.log("3. Candidates after Bias Filter:", candidatesToScore.length);

            // --- THE SCORING FUNNEL ---
            const dynamicFloor = baseAnime.score ? Math.max(5.0, baseAnime.score - 2.5) : 5.0;
            console.log("4. Using Rating Floor:", dynamicFloor);

            const scored = candidatesToScore.map(anime => {
                let matchScore = 0;
                anime.genres?.forEach(g => { if (baseTags.includes(g.mal_id)) matchScore += 1; });
                anime.themes?.forEach(t => { if (baseTags.includes(t.mal_id)) matchScore += 5; });
                anime.demographics?.forEach(d => { if (baseTags.includes(d.mal_id)) matchScore += 2; });
                return { ...anime, matchScore };
            });

            const afterFloor = scored.filter(anime => anime.score && anime.score >= dynamicFloor);
            console.log("5. Candidates above Rating Floor:", afterFloor.length);

            const finalResults = afterFloor
                .filter(a => a.mal_id !== baseAnime.mal_id)
                .filter(a => a.matchScore > 0); // This is the final gate

            console.log("6. Final results to display:", finalResults.length);

            renderAnimeCards(finalResults.slice(0, 15));

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

    grid.addEventListener("click", (event) => {

        const watchedBtn = event.target.closest(".btn-watched");
        const wantBtn = event.target.closest(".btn-want");

        if (!watchedBtn && !wantBtn) return;

        const card = event.target.closest(".anime-card");
        const title = card.querySelector("h3").innerText;
        const image = card.querySelector("img").src;

        const animeData = { title, image };

        if (watchedBtn) {
            const watchedList = JSON.parse(localStorage.getItem("watchedList")) || [];
            watchedList.push(animeData);
            localStorage.setItem("watchedList", JSON.stringify(watchedList));
            watchedBtn.innerText = "Saved ✓";
        }

        if (wantBtn) {
            const wantList = JSON.parse(localStorage.getItem("wantList")) || [];
            wantList.push(animeData);
            localStorage.setItem("wantList", JSON.stringify(wantList));
            wantBtn.innerText = "Saved ✓";
        }
    });
});