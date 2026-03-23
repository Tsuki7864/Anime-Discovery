import {
    toggleSave,
    getGenrePreferences,
    getLengthPreferences,
    getExcludedIds
} from './profileManager.js';

import { calculateRecommendations } from './algorithm.js';
import { renderAnimeCards, toggleLoading } from './ui.js';

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

let currentPage = 1;
let currentQuery = '';
document.addEventListener('DOMContentLoaded', async () => {

    const searchBtn = document.querySelector('#search-btn');
    const suggestBtn = document.querySelector('#btn-suggest');
    const resultsContainer = document.querySelector('#anime-grid');

    // --- THE FIX: AUTOMATIC SEARCH ON PAGE LOAD ---
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');

    // If there is a search query in the URL, fetch the anime immediately!
    if (searchQuery && resultsContainer) {
        currentQuery = searchQuery;
        currentPage = 1;
        toggleLoading(true);
        const results = await fetchFromJikan(`/anime?q=${encodeURIComponent(searchQuery)}&limit=25&page=1`);
        renderAnimeCards(results);
        toggleLoading(false);
        updateLoadMoreVisibility(results.length);
    }

    const loadMoreBtn = document.querySelector('#load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', async () => {
            currentPage++;
            toggleLoading(true);
            const results = await fetchFromJikan(
                `/anime?q=${encodeURIComponent(currentQuery)}&limit=25&page=${currentPage}`
            );
            renderAnimeCards(results, '#anime-grid', false, true); // append = true
            toggleLoading(false);
            updateLoadMoreVisibility(results.length);
        });
    }

    // SEARCH BUTTON (If you ever add a search bar back to results.html)
    if (searchBtn) {
        searchBtn.addEventListener('click', async () => {
            const query = document.querySelector('#search-input').value.trim();
            if (!query) return;

            toggleLoading(true);
            const results = await fetchFromJikan(`/anime?q=${encodeURIComponent(query)}&limit=25`);
            renderAnimeCards(results);
            toggleLoading(false);
        });
    }

    // SUGGEST BUTTON
    // --- UPDATED SUGGEST BUTTON ---
    if (suggestBtn) {
        suggestBtn.addEventListener('click', async () => {
            toggleLoading(true);

            try {
                // THE FIX: Broaden the pool! 
                // Instead of just the Top 25, we grab a random page from the top 125 most popular anime.
                // This guarantees fresh suggestions every time you click the button!
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

    // --- UPDATED BUTTON HANDLING (WITH TOGGLE & GUARANTEED SAVES) ---
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

                // Safely parse genres
                let parsedGenres = [];
                try { parsedGenres = JSON.parse(btn.dataset.genres || "[]"); } catch (e) { }

                // 1. Build the data object
                const animeData = {
                    mal_id: parseInt(btn.dataset.id),
                    title: btn.dataset.title,
                    image: btn.dataset.image,
                    episodes: parseInt(btn.dataset.episodes) || 0,
                    genres: parsedGenres,
                    synopsis: decodeURIComponent(btn.dataset.synopsis || 'No description available.'),
                    aired: { string: btn.dataset.aired || 'Unknown Date' },
                    url: btn.dataset.url
                };

                // 2. Check what's currently in Local Storage
                let list = JSON.parse(localStorage.getItem(listName)) || [];
                const existingIndex = list.findIndex(a => a.mal_id === animeData.mal_id);

                if (existingIndex > -1) {
                    // TOGGLE OFF: It's already saved, so remove it!
                    list.splice(existingIndex, 1);
                    localStorage.setItem(listName, JSON.stringify(list));

                    btn.classList.remove('active');
                    btn.innerText = isWatched ? "🕒" : "🔖";
                    if (sibling) sibling.style.display = 'inline-block'; // Bring sibling back
                } else {
                    // TOGGLE ON: Not saved yet, so add it!
                    list.push(animeData);
                    localStorage.setItem(listName, JSON.stringify(list));

                    btn.classList.add('active');
                    btn.innerText = isWatched ? "✓ Saved" : "★ Added";
                    if (sibling) sibling.style.display = 'none'; // Hide sibling
                }

                // 3. Check if we need to show/hide the Suggest Button
                updateSuggestButtonVisibility();
            }
        });
    }
});
// --- AUTO-HIDE SUGGESTION BUTTON ---
function updateSuggestButtonVisibility() {
    const suggestBtn = document.getElementById('btn-suggest');
    if (!suggestBtn) return; // If we aren't on the results page, do nothing

    const watched = JSON.parse(localStorage.getItem('watchedList')) || [];
    const want = JSON.parse(localStorage.getItem('wantList')) || [];

    // If BOTH lists are totally empty, hide the button. Otherwise, show it!
    if (watched.length === 0 && want.length === 0) {
        suggestBtn.style.display = 'none';
    } else {
        suggestBtn.style.display = 'inline-block';
    }
}

// Run this once as soon as the page loads!
document.addEventListener('DOMContentLoaded', updateSuggestButtonVisibility);