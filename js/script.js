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
            return data.data || []; // FIXED: Ensure it always returns an array, NEVER undefined!

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
    <a class="anime-link" href="${anime.url}" target="_blank" rel="noopener noreferrer">
        <img src="${img}" alt="${anime.title}">
        <div class="anime-overlay">
            <h3>${anime.title}</h3>
            <p>${description}</p>
        </div>
    </a>

    <div class="overlay-buttons">
        <button class="btn-watched" data-id="${anime.mal_id}">Watched</button>
        <button class="btn-want" data-id="${anime.mal_id}">Want</button>
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
        const results = await fetchFromJikan(`/anime?q=${query}&limit=25`);
        renderAnimeCards(results);
        if (overlay) overlay.style.display = "none";
    }

    const suggestBtn = document.querySelector("#btn-suggest");

    // FIXED: Only one event listener, and 'event' is properly passed in!
    // FIXED: Only one event listener, and 'event' is properly passed in!
    suggestBtn?.addEventListener("click", async (event) => {
        // --- [CHANGE 1: BUTTON UI LOCK] ---
        const btn = event.currentTarget;
        if (btn.disabled) return;
        btn.disabled = true;
        btn.innerText = "Analyzing...";

        if (overlay) overlay.style.display = "flex";

        try {
            const params = new URLSearchParams(window.location.search);
            const query = params.get("q");

            if (!query) {
                alert("Search for an anime first.");
                return;
            }

            // --- [CHANGE 2: SEARCH LIMIT & DEDUPLICATION] ---
            let searchResults = await fetchFromJikan(`/anime?q=${query}&limit=25`);

            if (!searchResults || !searchResults.length) {
                alert("Anime not found.");
                return;
            }

            // Clean up the API's messy duplicates (Fixes Tensura showing up twice)
            const seenSearchTitles = new Set();
            searchResults = searchResults.filter(anime => {
                const title = anime.title.toLowerCase();
                if (seenSearchTitles.has(title)) return false;
                seenSearchTitles.add(title);
                return true;
            });

            // --- [CHANGE 3: SELECTING THE BASE] ---
            const baseAnime = searchResults[0];

            // --- [CHANGE 4: GENRE-FIRST TAG PREP] ---
            const baseGenres = (baseAnime.genres || []).map(tag => tag.mal_id);
            const baseThemes = (baseAnime.themes || []).map(tag => tag.mal_id);
            const baseDemos = (baseAnime.demographics || []).map(tag => tag.mal_id);

            const mainTags = [
                (baseGenres[0] || null),
                (baseThemes[0] || null),
                (baseDemos[0] || baseGenres[1] || null)
            ].filter(id => id !== null);

            // Instead of making multiple requests and risking a 429 ban, we make ONE request.
            let uniqueCandidates = [];

            if (mainTags.length > 0) {
                // Grab just the top 1 or 2 most important tags to cast a strong, single net
                const queryTags = mainTags.slice(0, 2).join(',');

                // Give Jikan a solid 1.5-second breather after the initial search
                await delay(1500);

                // Fetch up to 50 shows in one single burst!
                const res = await fetchFromJikan(`/anime?genres=${queryTags}&order_by=members&sort=desc&limit=50`);

                if (res && Array.isArray(res)) {
                    const seenIds = new Set();
                    uniqueCandidates = res.filter(a => {
                        if (!a || !a.mal_id) return false;
                        if (seenIds.has(a.mal_id)) return false;
                        seenIds.add(a.mal_id);
                        return true;
                    });
                }
            }

            const baseTags = [...baseThemes, ...baseGenres, ...baseDemos];
            const candidatesToScore = uniqueCandidates;

            const toneConflicts = {
                'Comedy': ['Gore', 'Dark Fantasy', 'Suspense', 'Horror', 'Psychological'],
                'Slice of Life': ['Gore', 'Military', 'High Stakes', 'Survival', 'Psychological'],
                'Kids': ['Gore', 'Horror', 'Erotica', 'Psychological'],
                'Iyashikei': ['Gore', 'Horror', 'Suspense']
            };

            let bannedTags = [];
            baseAnime.genres?.forEach(g => {
                if (toneConflicts[g.name]) {
                    bannedTags = bannedTags.concat(toneConflicts[g.name]);
                }
            });

            const dynamicFloor = 7.5;

            // --- [CHANGE 6: THEME-HEAVY SCORING] ---
            const scored = candidatesToScore.map(anime => {
                let matchScore = 0;

                anime.genres?.forEach(g => { if (baseTags.includes(g.mal_id)) matchScore += 10; });
                anime.themes?.forEach(t => { if (baseTags.includes(t.mal_id)) matchScore += 30; });
                anime.demographics?.forEach(d => { if (baseTags.includes(d.mal_id)) matchScore += 5; });

                if (bannedTags.length > 0) {
                    const hasConflict = anime.genres?.some(g => bannedTags.includes(g.name)) ||
                        anime.themes?.some(t => bannedTags.includes(t.name));
                    if (hasConflict) matchScore = -999;
                }

                return { ...anime, matchScore };
            });

            // --- [CHANGE 7: FINAL DISPLAY LIMIT & FRANCHISE FILTER] ---
            const getRootFranchise = (title) => {
                if (!title) return "";
                let root = title.split(/[:\-]/)[0].toLowerCase().trim();
                root = root.replace(/\s+(season|part|chapter|cour|tv|the movie)\b.*/g, '');
                root = root.replace(/\s+(ii|iii|iv|v|vi|vii|viii|ix|x|\d+)$/g, '');
                return root.trim();
            };

            const rootBaseFranchise = getRootFranchise(baseAnime.title);
            const seenFranchises = new Set();

            const finalResults = scored
                .filter(a => a && a.mal_id && a.mal_id !== baseAnime.mal_id)
                .filter(a => a.score && a.score >= dynamicFloor)
                .filter(a => a.matchScore >= 10)
                .sort((a, b) => {
                    // YOUR IDEA: Primary Sort by Match Score
                    if (b.matchScore !== a.matchScore) {
                        return b.matchScore - a.matchScore;
                    }
                    // YOUR IDEA: Secondary Sort by MAL Rating for tie-breakers!
                    return (b.score || 0) - (a.score || 0);
                })
                .filter(anime => {
                    const candidateRoot = getRootFranchise(anime.title);
                    if (candidateRoot.includes(rootBaseFranchise) || rootBaseFranchise.includes(candidateRoot)) return false;
                    if (seenFranchises.has(candidateRoot)) return false;

                    seenFranchises.add(candidateRoot);
                    return true;
                });

            renderAnimeCards(finalResults.slice(0, 20));
        } catch (error) {
            console.error("Engine Error:", error);
        } finally {
            if (overlay) overlay.style.display = "none";
            btn.disabled = false;
            btn.innerText = "Smart Recommendations";
        }
    });

});


const grid = document.querySelector("#anime-grid");

grid?.addEventListener("click", (event) => {

    const watchedBtn = event.target.closest(".btn-watched");
    const wantBtn = event.target.closest(".btn-want");

    if (!watchedBtn && !wantBtn) return;

    const card = event.target.closest(".anime-card");
    const title = card.querySelector("h3").innerText;
    const image = card.querySelector("img").src;
    const malId = Number((watchedBtn || wantBtn).dataset.id);

    const animeData = { malId, title, image };

    if (watchedBtn) {
        const watchedList = JSON.parse(localStorage.getItem("watchedList")) || [];

        const alreadySaved = watchedList.some(a => a.malId === malId);

        if (!alreadySaved) {
            watchedList.push(animeData);
            localStorage.setItem("watchedList", JSON.stringify(watchedList));
            watchedBtn.innerText = "Saved ✓";
        } else {
            watchedBtn.innerText = "Already Saved";
        }
    }

    if (wantBtn) {
        const wantList = JSON.parse(localStorage.getItem("wantList")) || [];

        const alreadySaved = wantList.some(a => a.malId === malId);

        if (!alreadySaved) {
            wantList.push(animeData);
            localStorage.setItem("wantList", JSON.stringify(wantList));
            wantBtn.innerText = "Saved ✓";
        } else {
            wantBtn.innerText = "Already Saved";
        }
    }

});


