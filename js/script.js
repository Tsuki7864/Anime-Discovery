import { 
    addToWatched, addToWantList, 
    getGenrePreferences, getLengthPreferences, getExcludedIds 
} from './profileManager.js';

const BASE_URL = "https://api.jikan.moe/v4";
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- 1. API FETCHING ---
async function fetchFromJikan(endpoint) {
    await delay(600); 
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

// --- 2. THE ALGORITHM (The "Brain") ---
function calculateRecommendations(candidates) {
    const genrePrefs = getGenrePreferences();
    const lengthPrefs = getLengthPreferences();
    
    return candidates.map(anime => {
        let score = 0;
        
        // A. Factor 1: Genre Matching
        if (anime.genres) {
            anime.genres.forEach(g => {
                if (genrePrefs[g.name]) {
                    score += genrePrefs[g.name]; // Add exact genre points
                }
            });
        }

        // B. Factor 2: Length Matching
        const epCount = anime.episodes || 0;
        let lengthCategory = "unknown";
        
        if (epCount > 0 && epCount <= 13) lengthCategory = "short";
        else if (epCount > 13 && epCount <= 26) lengthCategory = "medium";
        else if (epCount > 26) lengthCategory = "long";

        // Give a 1.5x multiplier bonus if it matches their length preferences
        if (lengthCategory !== "unknown" && lengthPrefs[lengthCategory]) {
            score += (lengthPrefs[lengthCategory] * 1.5);
        }

        return {
            ...anime,
            matchScore: Math.round(score), // Clean integer
            matchCategory: lengthCategory
        };
    }).sort((a, b) => b.matchScore - a.matchScore); // Sort Highest to Lowest
}

// --- 3. UI GENERATOR ---
function renderAnimeCards(animeList) {
    const resultsContainer = document.querySelector('#anime-grid');
    resultsContainer.innerHTML = ''; 

    if (!animeList || animeList.length === 0) {
        resultsContainer.innerHTML = '<p>No results found.</p>';
        return;
    }

    animeList.forEach(anime => {
        const genresJson = JSON.stringify(anime.genres || []).replace(/"/g, '&quot;');
        const imgUrl = anime.images?.jpg?.image_url || 'https://via.placeholder.com/225x318?text=No+Image';
        const epText = anime.episodes ? `${anime.episodes} Episodes` : 'Ongoing';
        
        const card = document.createElement('div');
        card.className = 'anime-card';
        card.innerHTML = `
            <img src="${imgUrl}" alt="${anime.title}">
            <h3>${anime.title}</h3>
            <p style="font-size: 0.9em; color: #555;">${epText}</p>
            ${anime.matchScore !== undefined ? `<p style="color: #4CAF50;"><strong>Match Score: ${anime.matchScore}</strong></p>` : ''}
            
            <div class="btn-group">
                <button class="btn-mal" onclick="window.open('${anime.url}', '_blank')">MyAnimeList</button>
                <button class="btn-watched" data-id="${anime.mal_id}" data-episodes="${anime.episodes || 0}" data-title="${anime.title}" data-genres="${genresJson}">✓ Watched</button>
                <button class="btn-want" data-id="${anime.mal_id}" data-episodes="${anime.episodes || 0}" data-title="${anime.title}" data-genres="${genresJson}">★ Want to Watch</button>
            </div>
        `;
        resultsContainer.appendChild(card);
    });
}

// --- 4. MAIN EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.querySelector('#search-btn');
    const suggestBtn = document.querySelector('#btn-suggest');
    const loadingOverlay = document.querySelector('#loading-overlay');
    const resultsContainer = document.querySelector('#anime-grid');

    // A. Search Action
    if (searchBtn) {
        searchBtn.addEventListener('click', async () => {
            const query = document.querySelector('#search-input').value;
            if (!query) return;
            
            loadingOverlay.style.display = 'flex';
            const results = await fetchFromJikan(`/anime?q=${query}&limit=12`);
            renderAnimeCards(results);
            loadingOverlay.style.display = 'none';
        });
    }

    // B. Suggest Action (The Engine Trigger)
    if (suggestBtn) {
        suggestBtn.addEventListener('click', async () => {
            loadingOverlay.style.display = 'flex';
            
            try {
                // Fetch a large pool of popular anime to test against
                const candidates = await fetchFromJikan('/top/anime?limit=25');
                
                // Score them
                const scored = calculateRecommendations(candidates);
                
                // Apply Exclusion Filter
                const exclusions = getExcludedIds();
                const finalPicks = scored.filter(a => !exclusions.includes(a.mal_id));
                
                // Show the top 10 matches
                renderAnimeCards(finalPicks.slice(0, 10));

            } catch (err) {
                console.error(err);
                alert("Error generating suggestions.");
            } finally {
                loadingOverlay.style.display = 'none';
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
                const animeData = {
                    mal_id: parseInt(btn.dataset.id),
                    title: btn.dataset.title,
                    episodes: parseInt(btn.dataset.episodes) || 0,
                    genres: JSON.parse(btn.dataset.genres.replace(/&quot;/g, '"') || "[]")
                };

                if (watchedBtn) {
                    addToWatched(animeData);
                    watchedBtn.classList.add('active');
                    watchedBtn.innerText = "✓ Saved (Watched)";
                    wantBtn.style.display = 'none'; // Hide the other button to prevent clicking both
                } else {
                    addToWantList(animeData);
                    wantBtn.classList.add('active');
                    wantBtn.innerText = "★ Added to List";
                    watchedBtn.style.display = 'none';
                }
            }
        });
    }
});