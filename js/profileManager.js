// profileManager.js
// ROLE: The "Mock Database" - Handles saving/loading and genre weighting

const STORAGE_KEY = 'otakuMatch_user_profile';

// Default empty profile
let userProfile = {
    watched: [],       // List of IDs (History)
    wantToWatch: [],   // List of IDs (Intent)
    genrePreferences: {} // { "Action": 5, "Romance": 2 }
};

// 1. Load data from Browser LocalStorage
export function loadUserProfile() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            userProfile = JSON.parse(saved);
            console.log("Backend: User profile loaded.", userProfile);
        } catch (e) {
            console.error("Backend: Corrupt profile data found. Resetting.");
            resetProfile();
        }
    }
    return userProfile;
}

// 2. Save data to Browser LocalStorage
function saveProfile() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userProfile));
}

// 3. Action: Add to Watched (Weight: 1)
export function addToWatched(anime) {
    // Prevent duplicates
    if (userProfile.watched.includes(anime.mal_id)) return;
    
    userProfile.watched.push(anime.mal_id);
    
    // Update Genre Weights (Standard Boost)
    updateGenreStats(anime.genres, 1); 
    
    saveProfile();
    console.log(`Backend: ${anime.title} added to History (Weight +1).`);
}

// 4. Action: Add to Want-to-Watch (Weight: 3)
export function addToWantList(anime) {
    if (userProfile.wantToWatch.includes(anime.mal_id)) return;

    userProfile.wantToWatch.push(anime.mal_id);
    
    // Update Genre Weights (High Priority Boost!)
    updateGenreStats(anime.genres, 3); 
    
    saveProfile();
    console.log(`Backend: ${anime.title} added to Want-to-Watch (Weight +3).`);
}

// 5. Helper: Update the genre "Bank" with safety checks
function updateGenreStats(genres, weight) {
    // SAFETY CHECK: If genres is null/undefined/empty, stop.
    if (!genres || !Array.isArray(genres)) return;

    genres.forEach(g => {
        // Ensure the genre has a name
        if (g && g.name) {
            if (!userProfile.genrePreferences[g.name]) {
                userProfile.genrePreferences[g.name] = 0;
            }
            userProfile.genrePreferences[g.name] += weight;
        }
    });
}

// 6. Getter: Expose preferences for the Algorithm
export const getGenrePreferences = () => userProfile.genrePreferences;

// 7. Getter: Get list of IDs to EXCLUDE (Watched + Want)
export function getExcludedIds() {
    // Returns a combined list of unique IDs to hide from recommendations
    return [...new Set([...userProfile.watched, ...userProfile.wantToWatch])];
}

// 8. Debug Tool: Reset Profile
export function resetProfile() {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
}

// Auto-initialize when file is imported
loadUserProfile();