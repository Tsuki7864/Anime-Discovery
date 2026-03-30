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
    const loadMoreBtn = document.querySelector('#load-more-btn');

    // --- 1. AUTOMATIC SEARCH ON PAGE LOAD ---
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');

    if (searchQuery && resultsContainer) {
        currentQuery = searchQuery;
        currentPage = 1;
        toggleLoading(true);
        const results = await fetchFromJikan(`/anime?q=${encodeURIComponent(searchQuery)}&limit=24&page=1`);
        renderAnimeCards(results);
        toggleLoading(false);
        updateLoadMoreVisibility(results.length);
    }

    // --- 2. LOAD MORE BUTTON ---
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', async () => {
            currentPage++;
            toggleLoading(true);
            const results = await fetchFromJikan(
                `/anime?q=${encodeURIComponent(currentQuery)}&limit=25&page=${currentPage}`
            );
            // Assuming your ui.js renderAnimeCards accepts an append boolean as the 4th argument
            renderAnimeCards(results, '#anime-grid', false, true);
            toggleLoading(false);
            updateLoadMoreVisibility(results.length);
        });
    }

    // --- 3. SEARCH BUTTON ---
    if (searchBtn) {
        searchBtn.addEventListener('click', async () => {
            const query = document.querySelector('#search-input').value.trim();
            if (!query) return;

            currentQuery = query;  // store for Load More
            currentPage = 1;       // reset to page 1 on every new search

            toggleLoading(true);
            const results = await fetchFromJikan(`/anime?q=${encodeURIComponent(query)}&limit=25&page=1`);
            renderAnimeCards(results);
            toggleLoading(false);
            updateLoadMoreVisibility(results.length);
        });
    }

    // --- 4. SUGGEST BUTTON ---
    if (suggestBtn) {
        suggestBtn.addEventListener('click', async () => {
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

                renderAnimeCards(finalPicks.slice(0, 10));
            } catch (err) {
                console.error(err);
                alert("Error generating suggestions.");
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

});

// --- HELPER FUNCTIONS ---
function updateLoadMoreVisibility(resultCount) {
    const loadMoreBtn = document.querySelector('#load-more-btn');
    if (!loadMoreBtn) return;
    loadMoreBtn.style.display = resultCount === 25 ? 'block' : 'none';
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