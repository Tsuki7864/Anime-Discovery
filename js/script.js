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
const BASE_URL = "https://api.jikan.moe/v4";
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
                const randomPage = Math.floor(Math.random() * 5) + 1;
                const candidates = await fetchFromJikan(`/top/anime?filter=bypopularity&page=${randomPage}&limit=25`);

                const userProfile = {
                    genrePreferences: getGenrePreferences(),
                    lengthPreferences: getLengthPreferences()
                };

                const scored = calculateRecommendations(candidates, userProfile);
                const exclusions = new Set(getExcludedIds());

                const finalPicks = scored.filter(anime => !exclusions.has(anime.mal_id));
                finalPicks.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

                // Change the page title to indicate these are suggestions
                const titleSpan = document.getElementById('search-query');
                if (titleSpan) titleSpan.textContent = "Your Recommendations";

                // Hide pagination controls since suggestions don't have pages
                const paginationControls = document.getElementById('pagination-controls');
                if (paginationControls) paginationControls.style.display = 'none';

                renderAnimeCards(finalPicks.slice(0, 10));

                // 2. Start the 3-second cooldown timer before they can click it again
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
            // We use replaceState so we don't accidentally create an infinite loop of back-button clicks
            loadSearchPage(q, p);
        }
    });
});

// --- HELPER FUNCTIONS ---
// --- PAGINATION HELPER FUNCTIONS ---
async function loadSearchPage(query, pageNumber) {
    const grid = document.querySelector('#anime-grid');
    if (!grid) return;

    currentQuery = query;
    currentPage = pageNumber;

    // --- ADD THESE TWO LINES FOR THE BACK BUTTON ---
    const newUrl = `${window.location.pathname}?q=${encodeURIComponent(query)}&page=${pageNumber}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    toggleLoading(true);

    // Fetch using your teammate's bulletproof function
    const results = await fetchFromJikan(`/anime?q=${encodeURIComponent(currentQuery)}&limit=15&page=${currentPage}`);

    if (results.length === 0) {
        grid.innerHTML = '<p style="text-align:center; width:100%; font-size: 1.2rem; margin-top: 50px;">No anime found.</p>';
        updatePaginationButtons(0); // This forces the Next button to hide!
        toggleLoading(false);
        return; // Stop running the rest of the function
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

    const watched = JSON.parse(localStorage.getItem('watchedList')) || [];
    const want = JSON.parse(localStorage.getItem('wantList')) || [];

    if (watched.length === 0 && want.length === 0) {
        suggestBtn.style.display = 'none';
    } else {
        suggestBtn.style.display = 'inline-block';
    }
}

// Run this once as soon as the page loads!
document.addEventListener('DOMContentLoaded', updateSuggestButtonVisibility);