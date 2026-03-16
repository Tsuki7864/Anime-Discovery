import {
    addToWatched,
    addToWantList,
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

document.addEventListener('DOMContentLoaded', async () => {

    const searchBtn = document.querySelector('#search-btn');
    const suggestBtn = document.querySelector('#btn-suggest');
    const resultsContainer = document.querySelector('#anime-grid');

    // --- THE FIX: AUTOMATIC SEARCH ON PAGE LOAD ---
    // Look at the web address and see if there is a "?q=..."
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');

    // If there is a search query in the URL, fetch the anime immediately!
    if (searchQuery && resultsContainer) {
        toggleLoading(true);
        const results = await fetchFromJikan(`/anime?q=${encodeURIComponent(searchQuery)}&limit=12`);
        renderAnimeCards(results);
        toggleLoading(false);
    }
    // ----------------------------------------------


    // SEARCH BUTTON (If you ever add a search bar back to results.html)
    if (searchBtn) {
        searchBtn.addEventListener('click', async () => {
            const query = document.querySelector('#search-input').value.trim();
            if (!query) return;

            toggleLoading(true);
            const results = await fetchFromJikan(`/anime?q=${encodeURIComponent(query)}&limit=12`);
            renderAnimeCards(results);
            toggleLoading(false);
        });
    }

    // SUGGEST BUTTON
    if (suggestBtn) {
        suggestBtn.addEventListener('click', async () => {
            toggleLoading(true);

            try {
                const candidates = await fetchFromJikan('/top/anime?limit=25');

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

    // BUTTON HANDLING FOR ANIME CARDS
    if (resultsContainer) {
        resultsContainer.addEventListener('click', (event) => {
            const target = event.target;
            const watchedBtn = target.closest('.btn-watched');
            const wantBtn = target.closest('.btn-want');

            if (watchedBtn || wantBtn) {
                const btn = watchedBtn || wantBtn;
                const animeData = {
                    mal_id: parseInt(btn.dataset.id),
                    title: btn.dataset.title,
                    episodes: parseInt(btn.dataset.episodes) || 0,
                    genres: safeParseDataset(btn.dataset.genres),
                    themes: safeParseDataset(btn.dataset.themes),
                    demographics: safeParseDataset(btn.dataset.demographics)
                };

                if (watchedBtn) {
                    addToWatched(animeData);
                    watchedBtn.classList.add('active');
                    watchedBtn.innerText = "✓ Saved (Watched)";
                    if (wantBtn) wantBtn.style.display = 'none';
                } else {
                    addToWantList(animeData);
                    wantBtn.classList.add('active');
                    wantBtn.innerText = "★ Added to List";
                    if (watchedBtn) watchedBtn.style.display = 'none';
                }
            }
        });
    }
});