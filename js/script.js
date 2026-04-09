import {
    toggleSave,
    getGenrePreferences,
    getLengthPreferences,
    getExcludedIds
} from './profileManager.js';

import { calculateRecommendations } from './algorithm.js';
import { renderAnimeCards, toggleLoading } from './ui.js';

let currentPage = 1;
let currentQuery = "";
let isViewingSuggestions = false; // <-- ADD THIS
const BASE_URL = "https://api.jikan.moe/v4";
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let isSfwActive = localStorage.getItem('safeSearch') === null
    ? true
    : localStorage.getItem('safeSearch') === 'true';

function getSfwString() {
    return isSfwActive ? '&sfw=true' : '';
}
// AFTER — add below getSfwString()
function filterExplicitContent(animeArray) {
    if (!isSfwActive) return animeArray;
    return animeArray.filter(anime => {
        const rating = anime.rating || "";
        // Rx = Hentai, R+ = Mild Nudity — both get filtered
        return !rating.includes("Rx") && !rating.includes("R+");
    });
}
// --- THE BULLETPROOF FETCH INJECTED INTO TEAMMATE'S CODE ---

async function fetchFromJikan(endpoint, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await delay(600); // Base delay for Jikan rules
            const response = await fetch(`${BASE_URL}${endpoint}`);

            if (response.status === 429 || response.status >= 500) {
                console.warn(`Jikan overwhelmed (Error ${response.status}). Retrying in ${i + 1}s...`);
                await delay((i + 1) * 1000);
                continue;
            }

            if (!response.ok) throw new Error(`API Error: ${response.status}`);

            const data = await response.json();

            // Clean the data just like your teammate wanted
            return (data.data || []).map(anime => ({
                ...anime,
                genres: Array.isArray(anime.genres) ? anime.genres : [],
                themes: Array.isArray(anime.themes) ? anime.themes : [],
                demographics: Array.isArray(anime.demographics) ? anime.demographics : [],
                episodes: Number.isFinite(anime.episodes) ? anime.episodes : 0
            }));

        } catch (error) {
            if (i === retries - 1) {
                console.error("Max retries reached:", error);
                return [];
            }
            await delay(2000);
        }
    }
    return [];
}

function safeParseDataset(value) {
    try {
        return JSON.parse((value || "[]").replace(/&quot;/g, '"'));
    } catch {
        return [];
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    // Grab all our elements
    const searchBtn = document.querySelector('#search-btn');
    const suggestBtn = document.querySelector('#btn-suggest');
    const resultsContainer = document.querySelector('#anime-grid');
    const titleToggleBtn = document.querySelector('#title-toggle-btn');
    let showingAltTitles = false;
    // Grab our new pagination buttons
    const prevBtn = document.querySelector('#prev-page-btn');
    const nextBtn = document.querySelector('#next-page-btn');

    // --- 1. AUTOMATIC SEARCH ON PAGE LOAD ---
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');

    // --- SAFE SEARCH TOGGLE LOGIC ---
const safeSearchBtn = document.getElementById('safe-search-btn');

if (safeSearchBtn) {
    function updateSafeSearchButton() {
        if (isSfwActive) {
            safeSearchBtn.classList.add('active');
            safeSearchBtn.textContent = 'SAFE SEARCH: ON';
        } else {
            safeSearchBtn.classList.remove('active');
            safeSearchBtn.textContent = 'SAFE SEARCH: OFF';
        }
    }

    updateSafeSearchButton();

    safeSearchBtn.addEventListener('click', async () => {
        isSfwActive = !isSfwActive;
        localStorage.setItem('safeSearch', String(isSfwActive));
        updateSafeSearchButton();

        const urlParams = new URLSearchParams(window.location.search);
        const currentSearch = urlParams.get('q');

        if (!isViewingSuggestions && currentSearch && resultsContainer) {
            await loadSearchPage(currentSearch, currentPage || 1);
        } else if (isViewingSuggestions) {
            // Re-trigger the suggest button so it generates new SFW suggestions!
            suggestBtn.click();
        }
    });
}


    if (searchQuery && resultsContainer) {
        loadSearchPage(searchQuery, 1);
    }

    // --- 2. PAGINATION BUTTONS ---
    if (prevBtn) {
        prevBtn.addEventListener('click', (event) => {
            event.preventDefault(); // Stops the button from accidentally refreshing the page
            if (currentPage > 1) {
                loadSearchPage(currentQuery, currentPage - 1);
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (event) => {
            event.preventDefault(); // Stops the button from accidentally refreshing the page
            loadSearchPage(currentQuery, currentPage + 1);
        });
    }

    // --- 3. SEARCH BUTTON ---
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const query = document.querySelector('#search-input').value.trim();
            if (!query) return;
            loadSearchPage(query, 1); // Triggers our new, clean function!
        });
    }

    // --- PRESS 'ENTER' TO SEARCH ---
    const searchInput = document.querySelector('#search-input');

    if (searchInput && searchBtn) {
        searchInput.addEventListener('keypress', (event) => {
            // Check if the key pressed was 'Enter'
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevents the page from accidentally refreshing
                searchBtn.click();      // Triggers the exact same code as clicking the button!
            }
        });
    }
    // --- 4. SUGGEST BUTTON ---
    if (suggestBtn) {
        suggestBtn.addEventListener('click', async () => {
            // 1. Lock the button immediately to prevent spam
            suggestBtn.disabled = true;
            const originalText = suggestBtn.textContent;
            suggestBtn.textContent = "Generating...";
            suggestBtn.style.opacity = "0.5";
            suggestBtn.style.cursor = "not-allowed";

            toggleLoading(true);
            try {
                isViewingSuggestions = true; // Tell the app we are looking at suggestions
                
                const sfwParam = getSfwString();
                const userProfile = {
                    genrePreferences: getGenrePreferences(),
                    lengthPreferences: getLengthPreferences()
                };
                const exclusions = new Set(getExcludedIds());

                let finalPicks = [];
                let fetchAttempts = 0;

                // Keep fetching until we have at least 12 fresh anime, OR we've tried 4 times
                while (finalPicks.length < 12 && fetchAttempts < 4) {
                    const randomPage = Math.floor(Math.random() * 10) + 1; 
                    
                    let batch = await fetchFromJikan(`/top/anime?filter=bypopularity&page=${randomPage}&limit=25${sfwParam}`);
                    batch = filterExplicitContent(batch);
                    
                    let scoredBatch = calculateRecommendations(batch, userProfile);
                    
                    // Filter out ones we already saved
                    let validPicks = scoredBatch.filter(anime => !exclusions.has(anime.mal_id));
                    
                    finalPicks = [...finalPicks, ...validPicks];
                    fetchAttempts++;
                }

                // Remove any duplicates just in case the random pages overlapped
                finalPicks = [...new Map(finalPicks.map(anime => [anime.mal_id, anime])).values()];

                // Sort them highest to lowest
                finalPicks.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

                // Change the page title
                const titleSpan = document.getElementById('search-query');
                if (titleSpan) titleSpan.textContent = "Your Recommendations";

                // Hide pagination
                const paginationControls = document.getElementById('pagination-controls');
                if (paginationControls) paginationControls.style.display = 'none';

                // Render exactly 12 anime for your 6-column grid!
                renderAnimeCards(finalPicks.slice(0, 12));

                // ... cooldown timer ...
                suggestBtn.textContent = "Wait 3s...";
                setTimeout(() => {
                    suggestBtn.disabled = false;
                    suggestBtn.textContent = originalText;
                    suggestBtn.style.opacity = "1";
                    suggestBtn.style.cursor = "pointer";
                }, 3000);

            } catch (err) {
                console.error(err);
                alert("Error generating suggestions.");
                suggestBtn.disabled = false;
                suggestBtn.textContent = originalText;
                suggestBtn.style.opacity = "1";
                suggestBtn.style.cursor = "pointer";
            } finally {
                toggleLoading(false);
            }
        });
    }

    // --- 5. SAVING / CLICK HANDLING ---
    if (resultsContainer) {
        resultsContainer.addEventListener('click', (event) => {
            const watchedBtn = event.target.closest('.btn-watched');
            const wantBtn = event.target.closest('.btn-want');

            if (watchedBtn || wantBtn) {
                event.preventDefault();
                event.stopPropagation();

                const btn = watchedBtn || wantBtn;
                const isWatched = !!watchedBtn;
                const listName = isWatched ? 'watchedList' : 'wantList';
                const siblingClass = isWatched ? '.btn-want' : '.btn-watched';
                const sibling = btn.parentElement.querySelector(siblingClass);

                const animeData = {
                    mal_id: parseInt(btn.dataset.id),
                    title: btn.dataset.title,
                    image: btn.dataset.image,
                    episodes: parseInt(btn.dataset.episodes) || 0,
                    genres: safeParseDataset(btn.dataset.genres),
                    synopsis: decodeURIComponent(btn.dataset.synopsis || 'No description available.'),
                    aired: { string: btn.dataset.aired || 'Unknown Date' },
                    url: btn.dataset.url
                };

                const wasAdded = toggleSave(animeData, listName);

                if (wasAdded) {
                    btn.classList.add('active');
                    btn.innerText = isWatched ? "✓ Saved" : "★ Added";
                    if (sibling) sibling.style.display = 'none';
                } else {
                    btn.classList.remove('active');
                    btn.innerText = isWatched ? "🕒" : "🔖";
                    if (sibling) sibling.style.display = 'inline-block';
                }

                updateSuggestButtonVisibility();

            }
        });
    }

    updateSuggestButtonVisibility();
    // --- TITLE TOGGLE ---
    if (titleToggleBtn) {
        titleToggleBtn?.addEventListener("click", () => {
            showingAltTitles = !showingAltTitles;

            document.querySelectorAll(".anime-title").forEach(el => {
                const main = el.dataset.mainTitle || "";
                const alt = el.dataset.altTitle || "";

                if (showingAltTitles && alt.trim() !== "") {
                    el.textContent = alt;
                    el.title = alt;
                } else {
                    el.textContent = main;
                    el.title = main;
                }
            });

            if (showingAltTitles) {
                titleToggleBtn.classList.add("active");
                titleToggleBtn.textContent = "ENG";
            } else {
                titleToggleBtn.classList.remove("active");
                titleToggleBtn.textContent = "JP";
            }
        });
    }
    // This listens for the user clicking the browser's Back or Forward buttons
    window.addEventListener('popstate', () => {
        const params = new URLSearchParams(window.location.search);
        const q = params.get('q');
        const p = parseInt(params.get('page')) || 1;

        if (q) {
            // PASS 'false' SO IT DOESN'T PUSH A NEW STATE WHEN GOING BACKWARDS
            loadSearchPage(q, p, false);
        }
    });
});

// --- HELPER FUNCTIONS ---
// --- PAGINATION HELPER FUNCTIONS ---
async function loadSearchPage(query, pageNumber, updateHistory = true) {
    const grid = document.querySelector('#anime-grid');
    if (!grid) return;

    isViewingSuggestions = false; // Turn the flag OFF the moment a real search happens
    currentQuery = query;
    currentPage = parseInt(pageNumber, 10);

    // Reset the title back to normal just in case it was stuck on "Your Recommendations"
    const titleSpan = document.getElementById('search-query');
    if (titleSpan) titleSpan.textContent = `"${query}"`;

    // Only update history if we aren't using the browser's Back button
    if (updateHistory) {
        const newUrl = `${window.location.pathname}?q=${encodeURIComponent(query)}&page=${currentPage}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
    }

    toggleLoading(true);

    let results = await fetchFromJikan(
        `/anime?q=${encodeURIComponent(currentQuery)}&limit=18&page=${currentPage}${getSfwString()}`
    );
    
    results = filterExplicitContent(results);
    results.sort((a, b) => (b.Members || 0) - (a.Members || 0));
    
    if (results.length === 0) {
        grid.innerHTML = '<p style="text-align:center; width:100%; font-size: 1.2rem; margin-top: 50px;">No anime found.</p>';
        updatePaginationButtons(0); 
        toggleLoading(false);
        return; 
    }

    renderAnimeCards(results);
    toggleLoading(false);

    updatePaginationButtons(results.length);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updatePaginationButtons(resultCount) {
    const paginationControls = document.querySelector('#pagination-controls');
    const prevBtn = document.querySelector('#prev-page-btn');
    const nextBtn = document.querySelector('#next-page-btn');
    const pageIndicator = document.querySelector('#page-indicator');

    if (paginationControls) {
        // Hide the entire control bar if we are on page 1 and there are absolutely no results
        paginationControls.style.display = (resultCount === 0 && currentPage === 1) ? 'none' : 'flex';
    }

    if (prevBtn && nextBtn && pageIndicator) {
        pageIndicator.textContent = `Page ${currentPage}`;

        // Hide "Previous" if on Page 1, otherwise show it
        if (currentPage === 1) {
            prevBtn.style.display = 'none';
        } else {
            prevBtn.style.display = 'inline-block';
        }

        // Hide "Next" if we got fewer than 25 results (meaning no more pages), otherwise show it
        if (resultCount < 15) {
            nextBtn.style.display = 'none';
        } else {
            nextBtn.style.display = 'inline-block';
        }
    }
}

function updateSuggestButtonVisibility() {
    const suggestBtn = document.getElementById('btn-suggest');
    if (!suggestBtn) return;

    // Check if we are on the want or watched page
    const currentUrl = window.location.href.toLowerCase();
    if (currentUrl.includes('want') || currentUrl.includes('watched')) {
        suggestBtn.style.display = 'none';
        return; // Stop running
    }

    const watched = JSON.parse(localStorage.getItem('watchedList')) || [];
    const want = JSON.parse(localStorage.getItem('wantList')) || [];

    if (watched.length === 0 && want.length === 0) {
        suggestBtn.style.display = 'none';
    } else {
        suggestBtn.style.display = 'inline-block';
    }
}