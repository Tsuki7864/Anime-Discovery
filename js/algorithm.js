// 1. Imports from your other modules
import { 
    addToWatched, addToWantList, 
    getGenrePreferences, getLengthPreferences, getExcludedIds 
} from './profileManager.js';
import { calculateRecommendations } from './algorithm.js';
import { renderAnimeCards, toggleLoading } from './ui.js';

const BASE_URL = "https://api.jikan.moe/v4";
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- 1. API FETCHING ---
async function fetchFromJikan(endpoint) {
    await delay(600); // Speed bump to prevent API blocking
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        return data.data; 
    } catch (error) {
        console.error("Fetch Failed:", error);
        return [];
    }
}

// --- 2. MAIN EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.querySelector('#search-btn');
    const suggestBtn = document.querySelector('#btn-suggest');
    const resultsContainer = document.querySelector('#anime-grid');

    // A. Search Action
    if (searchBtn) {
        searchBtn.addEventListener('click', async () => {
            const query = document.querySelector('#search-input').value;
            if (!query) return;
            
            toggleLoading(true);
            const results = await fetchFromJikan(`/anime?q=${query}&limit=12`);
            renderAnimeCards(results);
            toggleLoading(false);
        });
    }

    // B. Suggest Action (The Engine Trigger)
    if (suggestBtn) {
        suggestBtn.addEventListener('click', async () => {
            toggleLoading(true);
            
            try {
                // 1. Get candidate animes from the API
                const candidates = await fetchFromJikan('/top/anime?limit=25');
                
                // 2. Package the user's profile data
                const userProfile = {
                    genrePreferences: getGenrePreferences(),
                    lengthPreferences: getLengthPreferences()
                };
                
                // 3. Send both to your new Algorithm Module!
                const scored = calculateRecommendations(candidates, userProfile);
                
                // 4. Apply Exclusion Filter (Remove shows they already interacted with)
                const exclusions = getExcludedIds();
                const finalPicks = scored.filter(a => !exclusions.includes(a.mal_id));
                
                // 5. Send to UI
                renderAnimeCards(finalPicks.slice(0, 10));

            } catch (err) {
                console.error(err);
                alert("Error generating suggestions.");
            } finally {
                toggleLoading(false);
            }
        });
    }

    // C. 3-Button Interaction Loop
    if (resultsContainer) {
        resultsContainer.addEventListener('click', (event) => {
            const target = event.target;
            const watchedBtn = target.closest('.btn-watched');
            const wantBtn = target.closest('.btn-want');

            if (watchedBtn || wantBtn) {
                const btn = watchedBtn || wantBtn;
                
                // Extract the data hidden in the UI button
                const animeData = {
                    mal_id: parseInt(btn.dataset.id),
                    title: btn.dataset.title,
                    episodes: parseInt(btn.dataset.episodes) || 0,
                    genres: JSON.parse(btn.dataset.genres.replace(/&quot;/g, '"') || "[]") // This now contains genres, themes, and demographics!
                };

                // Send to Database and update UI
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