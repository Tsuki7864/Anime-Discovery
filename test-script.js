const BASE_URL = "https://api.jikan.moe/v4";

// --- 1. UTILITY: Rate Limiter ---
// Jikan allows 3 requests per second. We pause 500ms between calls to be safe.
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- 2. API: Fetch Data ---
async function fetchFromJikan(endpoint) {
    await delay(600); // Throttling
    // console.log(`[API] Fetching: ${endpoint}...`); - redundent line

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

// --- 3. LOGIC: The Scoring Algorithm ---
// This is the "Brain". It ranks candidates based on the User's Favorites.
function calculateScores(userFavorites, candidates) {
    // console.log(`[LOGIC] Scoring ${candidates.length} candidates against ${userFavorites.length} favorites...`); - redundent line

    // Create a Profile of the user's taste
    const userProfile = {
        studios: new Set(),
        genres: new Set(),
        ids: new Set(userFavorites.map(f => f.mal_id))
    };

    // Populate Profile
    userFavorites.forEach(anime => {
        anime.studios.forEach(s => userProfile.studios.add(s.mal_id));
        anime.genres.forEach(g => userProfile.genres.add(g.mal_id));
    });

    // Score Candidates
    return candidates.map(anime => {
        // Disqualify if already watched
        if (userProfile.ids.has(anime.entry.mal_id)) return null;

        let score = 0;

        // Note: Jikan's recommendation endpoint provides limited data (no genres/studios usually).
        // So for this specific endpoint, we rely on the "votes" count provided by MyAnimeList users
        // acting as a "Community Trust" score.
        // If we did a full lookup, we would match genres here.

        // Simulating a basic score based on generic popularity/relevance
        score += 10;

        return {
            title: anime.entry.title,
            id: anime.entry.mal_id,
            url: anime.entry.url,
            score: score
        };
    }).filter(a => a !== null); // Remove nulls
}

// --- 4. THE SIMULATION (Main Function) ---
async function initApp() {
    console.clear();
    console.log("%c STARTING ANIME ENGINE...", "color: cyan; font-weight: bold; font-size: 14px;");

    // STEP A: Simulate User Search
    const searchQuery = "bleach";
    console.log(`%c 1. User searches for: "${searchQuery}"`, "color: yellow;");

    const searchResults = await fetchFromJikan(`/anime?q=${searchQuery}&limit=3`);

    if (searchResults.length === 0) {
        console.error("No results found. Stopping.");
        return;
    }

    // Display Search Results in Console Table
    // New way
    console.table(searchResults.map(a => ({
        Title: a.title,
        Rating: a.score ? `${a.score}` : "N/A", // Handled if score is missing
        Popularity: `#${a.popularity}` // Bonus: shows where it ranks globally
    })));
    // STEP B: Simulate User Selection
    // Let's pretend the user clicked the FIRST result found.
    const selectedAnime = searchResults[0];
    console.log(`%c 2. User selected: ${selectedAnime.title} (ID: ${selectedAnime.mal_id})`, "color: yellow;");

    // STEP C: Fetch Recommendations based on selection
    console.log(`%c 3. Fetching recommendations from API...`, "color: yellow;");
    const rawRecommendations = await fetchFromJikan(`/anime/${selectedAnime.mal_id}/recommendations`);

    // STEP D: Process & Rank
    // Jikan returns "entry" objects. We need to score them.
    const scoredList = calculateScores([selectedAnime], rawRecommendations);

    // Sort by Score (Descending) and take Top 5
    const finalResults = scoredList
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    // We use the (anime, index) syntax to grab the loop's position
    // --- STEP E: Final Output ---
    console.log("%c --- FINAL RECOMMENDATIONS ---", "color: lime; font-weight: bold; font-size: 14px;");

    const tableData = finalResults.map((anime) => {
        // 1. Create the preview string
const teaser = anime.synopsis 
        ? anime.synopsis.slice(0, 50) + "..." 
        : "Click link for info";

        return {
            "Title": anime.title,
            "Match": `${anime.similarityScore}%`,
            "Preview": teaser,
            "Link": anime.url // Placeholder for table clarity
        };
    });

console.table(tableData);
}

// Run the engine
initApp();