const STORAGE_KEY = 'otakuMatch_user_profile';

// Default empty profile
let userProfile = {
    watched: [],       // List of IDs
    wantToWatch: [],   // List of IDs
    genrePreferences: {} // { "Action": 5, "Romance": 2 }
};

// 1. Load data when the app starts
export function loadUserProfile() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        userProfile = JSON.parse(saved);
        console.log("Backend: User profile loaded.", userProfile);
    }
    return userProfile;
}

// 2. Save data (The "Commit" to database)
function saveProfile() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userProfile));
}

// 3. Action: Add to Watched
export function addToWatched(anime) {
    // Prevent duplicates
    if (userProfile.watched.includes(anime.mal_id)) return;

    console.log(`Backend: Adding ${anime.title} to History.`);
    userProfile.watched.push(anime.mal_id);
    
    // Update Genre Weights (Standard Boost)
    updateGenreStats(anime.genres, 1); 
    
    saveProfile();
}

// 4. Action: Add to Want-to-Watch
export function addToWantList(anime) {
    if (userProfile.wantToWatch.includes(anime.mal_id)) return;

    console.log(`Backend: User WANTS ${anime.title}. High priority!`);
    userProfile.wantToWatch.push(anime.mal_id);
    
    // Update Genre Weights (Big Boost!)
    updateGenreStats(anime.genres, 3); 
    
    saveProfile();
}

function updateGenreStats(genres, weight) {
    // SAFETY CHECK: If genres is null/undefined/empty, stop.
    if (!genres || !Array.isArray(genres)) {
        console.warn("Backend Warning: Attempted to update stats with no genre data.");
        return;
    }

    genres.forEach(g => {
        // SAFETY CHECK: Ensure the genre has a name
        if (g && g.name) {
            if (!userProfile.genrePreferences[g.name]) {
                userProfile.genrePreferences[g.name] = 0;
            }
            userProfile.genrePreferences[g.name] += weight;
        }
    });
}

// Export the raw data so the Algorithm can see it
export function getGenrePreferences() {
    return userProfile.genrePreferences;
}

// Auto-load on startup
loadUserProfile();