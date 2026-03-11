// These lines bring in functions from other files in the project.
// Each file has a different job:
// - profileManager handles saving user preferences
// - algorithm calculates recommendations
// - ui shows anime on the screen
import {
    addToWatched,
    addToWantList,
    getGenrePreferences,
    getLengthPreferences,
    getExcludedIds
} from './profileManager.js';

import { calculateRecommendations } from './algorithm.js';
import { renderAnimeCards, toggleLoading } from './ui.js';


// This is the base website address for the Jikan API.
// Every API request will start with this URL.
const BASE_URL = "https://api.jikan.moe/v4";


// This creates a small pause between API calls.
// It helps prevent the API from blocking our app if we send too many requests too quickly.
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


// This function safely converts JSON text stored inside HTML buttons.
// If something is wrong with the data, it returns an empty array instead of crashing the app.
function safeParseDataset(value) {
    try {
        return JSON.parse((value || "[]").replace(/&quot;/g, '"'));
    } catch {
        return [];
    }
}


// This function requests anime data from the Jikan API.
// It also cleans the data so the rest of the program always receives safe values.
async function fetchFromJikan(endpoint) {

    // Wait a little before making the request
    await delay(600);

    try {

        // Send the request to the API
        const response = await fetch(`${BASE_URL}${endpoint}`);

        // If the API returned an error, stop the request
        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        // Convert the response into JSON
        const data = await response.json();

        // Clean the data to make sure important fields always exist
        return (data.data || []).map(anime => ({
            ...anime,

            // Make sure genres is always an array
            genres: Array.isArray(anime.genres) ? anime.genres : [],

            // Make sure themes is always an array
            themes: Array.isArray(anime.themes) ? anime.themes : [],

            // Make sure demographics is always an array
            demographics: Array.isArray(anime.demographics) ? anime.demographics : [],

            // Make sure episodes is always a number
            episodes: Number.isFinite(anime.episodes) ? anime.episodes : 0
        }));

    } catch (error) {

        // If something fails, print the error and return an empty list
        console.error("Fetch Failed:", error);
        return [];
    }
}


// This waits until the webpage is fully loaded before running any JavaScript.
// This prevents errors where the code tries to access buttons that aren't loaded yet.
document.addEventListener('DOMContentLoaded', () => {

    // These lines find important elements on the page
    const searchBtn = document.querySelector('#search-btn');
    const suggestBtn = document.querySelector('#btn-suggest');
    const resultsContainer = document.querySelector('#anime-grid');



    // SEARCH BUTTON
    // When the user clicks the search button, we search the API for anime.
    if (searchBtn) {

        searchBtn.addEventListener('click', async () => {

            // Get the text typed into the search box
            const query = document.querySelector('#search-input').value.trim();

            // If the box is empty, stop
            if (!query) return;

            // Show the loading spinner
            toggleLoading(true);

            // Ask the API for anime matching the search term
            const results = await fetchFromJikan(
                `/anime?q=${encodeURIComponent(query)}&limit=12`
            );

            // Show the anime on the screen
            renderAnimeCards(results);

            // Hide the loading spinner
            toggleLoading(false);
        });
    }



    // SUGGEST BUTTON
    // When the user clicks suggest, the app generates recommendations.
    if (suggestBtn) {

        suggestBtn.addEventListener('click', async () => {

            toggleLoading(true);

            try {

                // Get a list of popular anime that we will score
                const candidates = await fetchFromJikan('/top/anime?limit=25');

                // Build a user profile using saved preferences
                const userProfile = {

                    // Genres the user tends to like
                    genrePreferences: getGenrePreferences(),

                    // Whether the user likes short or long shows
                    lengthPreferences: getLengthPreferences()
                };

                // Send the anime list and the user profile to the recommendation algorithm
                const scored = calculateRecommendations(candidates, userProfile);

                // Remove anime the user already watched or saved
                const exclusions = new Set(getExcludedIds());

                const finalPicks = scored.filter(anime => !exclusions.has(anime.mal_id));

                // Show the top 10 recommended anime
                renderAnimeCards(finalPicks.slice(0, 10));

            } catch (err) {

                // If something goes wrong, show an error
                console.error(err);
                alert("Error generating suggestions.");

            } finally {

                // Hide loading spinner when finished
                toggleLoading(false);
            }
        });
    }



    // BUTTON HANDLING FOR ANIME CARDS
    // This listens for clicks on the anime grid.
    // Instead of adding a listener to every button, we listen to the container.
    if (resultsContainer) {

        resultsContainer.addEventListener('click', (event) => {

            const target = event.target;

            // Check if the user clicked the Watched button
            const watchedBtn = target.closest('.btn-watched');

            // Check if the user clicked the Want button
            const wantBtn = target.closest('.btn-want');


            // If the click was on one of those buttons
            if (watchedBtn || wantBtn) {

                const btn = watchedBtn || wantBtn;

                // Rebuild the anime object using data stored in the button
                const animeData = {

                    mal_id: parseInt(btn.dataset.id),

                    title: btn.dataset.title,

                    episodes: parseInt(btn.dataset.episodes) || 0,

                    genres: safeParseDataset(btn.dataset.genres),

                    themes: safeParseDataset(btn.dataset.themes),

                    demographics: safeParseDataset(btn.dataset.demographics)
                };


                // If the user clicked Watched
                if (watchedBtn) {

                    // Save it to the watched list
                    addToWatched(animeData);

                    // Update the button appearance
                    watchedBtn.classList.add('active');
                    watchedBtn.innerText = "✓ Saved (Watched)";

                    if (wantBtn) wantBtn.style.display = 'none';
                }

                // If the user clicked Want
                else {

                    // Save it to the want list
                    addToWantList(animeData);

                    // Update the button appearance
                    wantBtn.classList.add('active');
                    wantBtn.innerText = "★ Added to List";

                    if (watchedBtn) watchedBtn.style.display = 'none';
                }
            }
        });
    }
});