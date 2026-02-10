import { addToWatched, addToWantList } from './profileManager.js';

const BASE_URL = "https://api.jikan.moe/v4";

// --- 1. UTILITY: Rate Limiter ---
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- 2. API: Fetch Data ---
async function fetchFromJikan(endpoint) {
    await delay(600); // Throttling
    console.log(`[API] Fetching: ${endpoint}...`);
    
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        return data.data; // Jikan returns data inside a "data" property
    } catch (error) {
        console.error("Fetch Failed:", error);
        return [];
    }
}

// --- TEMPORARY ALGORITHM (The Stub) ---
function calculateDummyScores(animeList) {
    return animeList.map(anime => {
        return {
            ...anime,
            matchScore: Math.floor(Math.random() * (99 - 70 + 1) + 70),
            matchReason: "Matches your love for Action", 
            synopsis: anime.synopsis || "No synopsis available.",
            url: anime.url
        };
    }).sort((a, b) => b.matchScore - a.matchScore);
}

// --- NEW: EVENT LISTENER SETUP (The "Traffic Cop") ---
// This waits for the HTML to be ready, then watches for clicks.
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Select the container where your anime cards will live.
    // Make sure your HTML has a <div id="anime-grid"></div>
    const resultsContainer = document.querySelector('#anime-grid');

    if (resultsContainer) {
        console.log("Backend Listener Active: Watching for button clicks...");

        // 2. Attach the "Delegated" Event Listener
        resultsContainer.addEventListener('click', (event) => {
            const target = event.target;

            // Check if the user clicked the "Watched" button (or icon inside it)
            const watchedBtn = target.closest('.btn-watched');
            const wantBtn = target.closest('.btn-want');

            // --- CASE A: User clicked "Watched" ---
            if (watchedBtn) {
                // Get the ID and Genres from the button's data attributes
                // Note: You'll need to pass genres as a JSON string in the HTML
                const animeId = watchedBtn.dataset.id;
                const genres = JSON.parse(watchedBtn.dataset.genres || "[]");

                // Call your Backend Function
                addToWatched({ mal_id: animeId, genres: genres, title: "Anime " + animeId });
                
                // Visual Feedback
                watchedBtn.classList.add('active');
                watchedBtn.innerText = "Saved!";
            }

            // --- CASE B: User clicked "Want to Watch" ---
            if (wantBtn) {
                const animeId = wantBtn.dataset.id;
                const genres = JSON.parse(wantBtn.dataset.genres || "[]");

                // Call your Backend Function
                addToWantList({ mal_id: animeId, genres: genres, title: "Anime " + animeId });
                
                // Visual Feedback
                wantBtn.classList.add('active');
                wantBtn.innerText = "Added!";
            }
        });
    } else {
        console.warn("Warning: #anime-grid not found in HTML. Event listeners not attached.");
    }
});