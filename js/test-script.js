// script.js
// IMPORTS MUST BE AT THE TOP
import { inherits } from 'node:util';
import { addToWatched, addToWantList, getGenrePreferences, getExcludedIds } from './profileManager.js';

const BASE_URL = "https://api.jikan.moe/v4";
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- 1. API: Fetch Data ---
async function fetchFromJikan(endpoint) {
    await delay(600); // Throttling for Jikan's 3 req/sec limit
    console.log(`[API] Fetching: ${endpoint}...`);
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

// --- 2. ALGORITHM STUB (The "Brain") ---
// Eventually, this logic will move to logic.js
function calculateScores(animeList) {
    const preferences = getGenrePreferences();
    
    return animeList.map(anime => {
        let score = 0;
        
        // Calculate Score based on User Preferences
        if (anime.genres) {
            anime.genres.forEach(g => {
                if (preferences[g.name]) {
                    score += preferences[g.name];
                }
            });
        }

        return {
            ...anime,
            matchScore: score, // The calculated weight
            synopsis: anime.synopsis || "No synopsis available."
        };
    }).sort((a, b) => b.matchScore - a.matchScore); // Sort by highest score
}

// --- 3. UI GENERATOR (The "Frontend" Helper) ---
function renderAnimeCards(animeList) {
    const resultsContainer = document.querySelector('#anime-grid');
    resultsContainer.innerHTML = ''; // Clear previous results

    if (animeList.length === 0) {
        resultsContainer.innerHTML = '<p>No results found.</p>';
        return;
    }

    animeList.forEach(anime => {
        // IMPORTANT: We convert genres to a string to store in the HTML button
        // using single quotes for the attribute wrapper and double quotes for the JSON.
        const genresJson = JSON.stringify(anime.genres || []).replace(/"/g, '&quot;');
        
        const card = document.createElement('div');
        card.className = 'anime-card';
        card.innerHTML = `
            <img src="${anime.images.jpg.image_url}" alt="${anime.title}">
            <h3>${anime.title}</h3>
            ${anime.matchScore ? `<p><strong>Match Score: ${anime.matchScore}</strong></p>` : ''}
            
            <div class="btn-group">
                <button class="btn-mal" onclick="window.open('${anime.url}', '_blank')">
                    MyAnimeList
                </button>
                
                <button class="btn-watched" 
                    data-id="${anime.mal_id}" 
                    data-title="${anime.title}"
                    data-genres="${genresJson}">
                    ✓ Watched
                </button>
                
                <button class="btn-want" 
                    data-id="${anime.mal_id}" 
                    data-title="${anime.title}"
                    data-genres="${genresJson}">
                    ★ Want to Watch
                </button>
            </div>
        `;
        resultsContainer.appendChild(card);
    });
}


// --- 4. MAIN EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.querySelector('#search-input');
    const searchBtn = document.querySelector('#search-btn');
    const suggestBtn = document.querySelector('#btn-suggest');
    const loadingOverlay = document.querySelector('#loading-overlay');
    const resultsContainer = document.querySelector('#anime-grid');

    // --- SEARCH LOGIC ---
    if (searchBtn) {
        searchBtn.addEventListener('click', async () => {
            const query = searchInput.value;
            if (!query) return;
            
            loadingOverlay.style.display = 'flex'; // Show loading
            const results = await fetchFromJikan(`/anime?q=${query}&limit=12`);
            renderAnimeCards(results);
            loadingOverlay.style.display = 'none'; // Hide loading
        });
    }

    // --- SUGGEST LOGIC (The Recommendation Engine) ---
    if (suggestBtn) {
        suggestBtn.addEventListener('click', async () => {
            loadingOverlay.style.display = 'flex';
            
            try {
                // 1. Get Candidates (Using 'Top Anime' as the pool for now)
                const candidates = await fetchFromJikan('/top/anime?filter=bypopularity&limit=25');
                
                // 2. Score them using the Algorithm
                const scored = calculateScores(candidates);
                
                // 3. Filter out shows the user has already seen/added
                const exclusions = getExcludedIds();
                const finalPicks = scored.filter(a => !exclusions.includes(a.mal_id));

                console.log("Backend: Recommendations generated", finalPicks.slice(0, 10));
                
                // 4. Render the Top 10
                renderAnimeCards(finalPicks.slice(0, 10));

            } catch (err) {
                console.error(err);
                alert("Error generating suggestions.");
            } finally {
                loadingOverlay.style.display = 'none';
            }
        });
    }

    // --- BUTTON CLICKS (Delegation) ---
    if (resultsContainer) {
        resultsContainer.addEventListener('click', (event) => {
            const target = event.target;
            const watchedBtn = target.closest('.btn-watched');
            const wantBtn = target.closest('.btn-want');

            if (watchedBtn || wantBtn) {
                const btn = watchedBtn || wantBtn;
                const animeId = parseInt(btn.dataset.id); // Parse ID as Integer
                const title = btn.dataset.title;
                
                // Safe JSON Parse for Genres
                let genres = [];
                try { 
                    genres = JSON.parse(btn.dataset.genres.replace(/&quot;/g, '"')); 
                } catch (e) { 
                    console.warn("Genre parse error", e); 
                }

                const animeData = { mal_id: animeId, genres: genres, title: title };

                if (watchedBtn) {
                    addToWatched(animeData);
                    watchedBtn.classList.add('active');
                    watchedBtn.innerText = "Saved to History";
                } else {
                    addToWantList(animeData);
                    wantBtn.classList.add('active');
                    wantBtn.innerText = "Added to List";
                }
            }
        });
    }
});

