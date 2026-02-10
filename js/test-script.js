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
function calculateDummyScores(animeList) {
    return animeList.map(anime => {
        return {
            ...anime, // Keep all original data (title, image, url)
            
            // FAKE SCORE: Random number between 70% and 99%
            matchScore: Math.floor(Math.random() * (99 - 70 + 1) + 70),
            
            // FAKE REASON: Just a placeholder string
            matchReason: "Matches your love for Action", 
            
            // ENSURE THESE EXIST (Data Contract)
            synopsis: anime.synopsis || "No synopsis available.",
            url: anime.url
        };
    }).sort((a, b) => b.matchScore - a.matchScore); // Sort by highest score
}

// --- 4. THE SIMULATION (Main Function) ---
async function initApp() {
    console.clear();
    console.log("%c STARTING ANIME ENGINE...", "color: cyan; font-weight: bold; font-size: 14px;");

    // STEP A: Simulate User Search
    const searchQuery = "naruto"; // Hardcoded for testing. In real app, this comes from user input.
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

// --- STEP D: Process & Rank ---
// 1. First, we must "flatten" the Jikan data because recommendations are inside an 'entry' object
const flattenedList = rawRecommendations.map(item => {
    return {
        title: item.entry.title,
        url: item.entry.url,
        mal_id: item.entry.mal_id,
        // Since the recommendations endpoint doesn't have a synopsis, 
        // we provide a placeholder until the real algorithm handles it.
        synopsis: "Click link to read synopsis on MyAnimeList..." 
    };
});

// 2. Call the dummy algorithm (Using the correct name from Step 3)
const scoredList = calculateDummyScores(flattenedList);

// 3. Take the top 10
const finalResults = scoredList.slice(0, 10);

// --- STEP E: Final Output ---
console.log("%c --- CLICKABLE RECOMMENDATIONS ---", "color: lime; font-weight: bold;");

const tableData = finalResults.map((anime, index) => ({
    "Index": index + 1,
    "Title": anime.title,
    "Match": `${anime.matchScore}%`, // Match the property name in calculateDummyScores
    "MAL Link": anime.url 
}));

console.table(tableData);
}

initApp();