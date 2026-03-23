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

export function toggleSave(anime, listName) {
    const isWatched = listName === 'watchedList';
    const weight = isWatched ? 2 : 5;
    const profileKey = isWatched ? 'watched' : 'wantToWatch';

    const allTags = [
        ...(anime.genres || []),
        ...(anime.themes || []),
        ...(anime.demographics || [])
    ];

    const isAlreadySaved = userProfile[profileKey].includes(anime.mal_id);

    if (isAlreadySaved) {
        // --- REMOVE ---
        // 1. Remove ID from profile
        userProfile[profileKey] = userProfile[profileKey].filter(id => id !== anime.mal_id);
        // 2. Deduct the genre and length points
        removeGenreStats(allTags, weight);
        removeLengthStats(anime.episodes, weight);
        // 3. Remove full object from the list in localStorage
        let list = JSON.parse(localStorage.getItem(listName)) || [];
        list = list.filter(a => a.mal_id !== anime.mal_id);
        localStorage.setItem(listName, JSON.stringify(list));
    } else {
        // --- ADD ---
        // 1. Add ID to profile
        userProfile[profileKey].push(anime.mal_id);
        // 2. Add genre and length points
        updateGenreStats(allTags, weight);
        updateLengthStats(anime.episodes, weight);
        // 3. Save full object to the list in localStorage
        let list = JSON.parse(localStorage.getItem(listName)) || [];
        list.push(anime);
        localStorage.setItem(listName, JSON.stringify(list));
    }

    saveProfile();
    return !isAlreadySaved; // true = was added, false = was removed
}

// Mirror functions of updateGenreStats and updateLengthStats
function removeGenreStats(genres, weight) {
    if (!genres || !Array.isArray(genres)) return;
    genres.forEach(g => {
        if (g && g.name && userProfile.genrePreferences[g.name] !== undefined) {
            userProfile.genrePreferences[g.name] -= weight;
        }
    });
}

function removeLengthStats(episodes, weight) {
    if (!episodes || episodes === 0) return;
    if (episodes <= 13) userProfile.lengthPreferences["short"] -= weight;
    else if (episodes <= 26) userProfile.lengthPreferences["medium"] -= weight;
    else userProfile.lengthPreferences["long"] -= weight;
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