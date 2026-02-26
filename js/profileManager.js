const STORAGE_KEY = 'anime_discovery_profile';

// Default empty profile
let userProfile = {
    watched: [],       
    wantToWatch: [],   
    genrePreferences: {}, 
    lengthPreferences: { "short": 0, "medium": 0, "long": 0 } // NEW: Length tracking
};

// 1. Load data
export function loadUserProfile() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            userProfile = JSON.parse(saved);
            // Safety check in case it's an old save file without length tracking
            if (!userProfile.lengthPreferences) {
                userProfile.lengthPreferences = { "short": 0, "medium": 0, "long": 0 };
            }
        } catch (e) {
            resetProfile();
        }
    }
    return userProfile;
}

function saveProfile() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userProfile));
}

// --- UPDATED ACTIONS IN profileManager.js ---

export function addToWantList(anime) {
    if (userProfile.wantToWatch.includes(anime.mal_id)) return;
    userProfile.wantToWatch.push(anime.mal_id);
    
    const allTags = [...(anime.genres || []), ...(anime.themes || []), ...(anime.demographics || [])];
    
    // TWEAK: "To Watch" is now the HEAVY weight (+5 Points)
    updateGenreStats(allTags, 5); 
    updateLengthStats(anime.episodes, 5);
    
    saveProfile();
}

export function addToWatched(anime) {
    if (userProfile.watched.includes(anime.mal_id)) return;
    userProfile.watched.push(anime.mal_id);
    
    const allTags = [...(anime.genres || []), ...(anime.themes || []), ...(anime.demographics || [])];
    
    // TWEAK: "Already Watched" is now the LIGHTER weight (+2 Points)
    updateGenreStats(allTags, 2); 
    updateLengthStats(anime.episodes, 2);
    
    saveProfile();
}

// 4. Update Helpers
function updateGenreStats(genres, weight) {
    if (!genres || !Array.isArray(genres)) return;
    genres.forEach(g => {
        if (g && g.name) {
            if (!userProfile.genrePreferences[g.name]) userProfile.genrePreferences[g.name] = 0;
            userProfile.genrePreferences[g.name] += weight;
        }
    });
}

function updateLengthStats(episodes, weight) {
    // If episodes is null/0 (ongoing/unknown), we just skip it
    if (!episodes || episodes === 0) return; 

    if (episodes <= 13) userProfile.lengthPreferences["short"] += weight;
    else if (episodes <= 26) userProfile.lengthPreferences["medium"] += weight;
    else userProfile.lengthPreferences["long"] += weight;
}

// 5. Getters for the Algorithm
export const getGenrePreferences = () => userProfile.genrePreferences;
export const getLengthPreferences = () => userProfile.lengthPreferences;
export function getExcludedIds() {
    return [...new Set([...userProfile.watched, ...userProfile.wantToWatch])];
}

// 6. Reset
export function resetProfile() {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
}

loadUserProfile();