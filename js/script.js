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

            // --- [CHANGE 2: SEARCH LIMIT] ---
            const searchResults = await fetchFromJikan(`/anime?q=${query}&limit=25`);

            if (!searchResults || !searchResults.length) {
                alert("Anime not found.");
                return;
            }

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

            let uniqueCandidates = [];

            // --- [CHANGE 5: MULTI-PAIR SNIPER FETCH] ---
            if (mainTags.length >= 2) {
                const pairs = [
                    [mainTags[0], mainTags[1]].join(','),
                    [mainTags[0], mainTags[2]].filter(id => id).join(','),
                    [mainTags[1], mainTags[2]].filter(id => id).join(',')
                ].filter(p => p.includes(','));

                const resultsArray = await Promise.all(pairs.map(p =>
                    fetchFromJikan(`/anime?genres=${p}&order_by=members&sort=desc&limit=15`)
                ));

                const seenIds = new Set();
                uniqueCandidates = resultsArray.flat().filter(a => {
                    if (seenIds.has(a.mal_id)) return false;
                    seenIds.add(a.mal_id);
                    return true;
                });
            }

            const baseTags = [...baseThemes, ...baseGenres, ...baseDemos];
            const candidatesToScore = uniqueCandidates;

            // 2. THE CONFLICT MAP: Define which vibes cannot coexist
            const toneConflicts = {
                'Comedy': ['Gore', 'Dark Fantasy', 'Suspense', 'Horror', 'Psychological'],
                'Slice of Life': ['Gore', 'Military', 'High Stakes', 'Survival', 'Psychological'],
                'Kids': ['Gore', 'Horror', 'Erotica', 'Psychological'],
                'Iyashikei': ['Gore', 'Horror', 'Suspense']
            };

            // 3. Build the dynamic list of banned tags for THIS specific search
            let bannedTags = [];
            baseAnime.genres?.forEach(g => {
                if (toneConflicts[g.name]) {
                    bannedTags = bannedTags.concat(toneConflicts[g.name]);
                }
            });

            // 4. Setup the Franchise Filter base variable
            const baseFranchiseName = baseAnime.title.split(/[:\-]/)[0].trim().toLowerCase();

            // --- [CHANGE 6: WEIGHTED SCORING & 7.5 FLOOR] ---
            const dynamicFloor = 7.5;

            // 5. Map and Score
            const scored = candidatesToScore.map(anime => {
                let matchScore = 0;

                anime.genres?.forEach(g => { if (baseTags.includes(g.mal_id)) matchScore += 10; });
                anime.themes?.forEach(t => { if (baseTags.includes(t.mal_id)) matchScore += 15; });
                anime.demographics?.forEach(d => { if (baseTags.includes(d.mal_id)) matchScore += 2; });

                // THE NEW DYNAMIC VIBE CHECK
                if (bannedTags.length > 0) {
                    const hasConflict = anime.genres?.some(g => bannedTags.includes(g.name)) ||
                        anime.themes?.some(t => bannedTags.includes(t.name));

                    if (hasConflict) {
                        matchScore = 0; // Instantly nuke ANY conflicting vibe!
                    }
                }

                return { ...anime, matchScore };
            });

            // --- [CHANGE 7: FINAL DISPLAY LIMIT & FRANCHISE FILTER] ---
            const finalResults = scored
                .filter(a => a.mal_id !== baseAnime.mal_id)
                .filter(a => a.score && a.score >= dynamicFloor)
                .filter(anime => {
                    // The Smart Franchise Split
                    const candidateFranchiseName = anime.title.split(/[:\-]/)[0].trim().toLowerCase();
                    return !candidateFranchiseName.includes(baseFranchiseName) &&
                        !baseFranchiseName.includes(candidateFranchiseName);
                })
                .filter(a => a.matchScore > 0) // Drop the nuked scores!
                .sort((a, b) => b.matchScore - a.matchScore);

            // Show the top 15 ultra-relevant results
            renderAnimeCards(finalResults.slice(0, 15));

        } catch (error) {
            console.error("Engine Error:", error);
        } finally {
            if (overlay) overlay.style.display = "none";
            btn.disabled = false;
            btn.innerText = "Smart Recommendations";
        }
    });

    grid.addEventListener("click", (event) => {

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

            const alreadySaved = watchedList.some(anime => anime.malId === malId);

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

            const alreadySaved = wantList.some(anime => anime.malId === malId);

            if (!alreadySaved) {
                wantList.push(animeData);
                localStorage.setItem("wantList", JSON.stringify(wantList));
                wantBtn.innerText = "Saved ✓";
            } else {
                wantBtn.innerText = "Already Saved";
            }
        }
    });
});