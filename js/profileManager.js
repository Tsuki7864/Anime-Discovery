// profileManager.js
const STORAGE_KEY = 'anime_discovery_profile';

let userProfile = {
    watched: [],
    wantToWatch: [],
    genrePreferences: {},
    lengthPreferences: { "short": 0, "medium": 0, "long": 0 } // NEW: Length tracking
};

export function loadUserProfile() {
    const saved = localStorage.getItem(STORAGE_KEY); // Look in the drawer
    if (saved) { // If we found the notebook...
        try {
            userProfile = JSON.parse(saved); // Open it up and read it

            // Just in case it's an old notebook missing the length section, add it!
            if (!userProfile.lengthPreferences) {
                userProfile.lengthPreferences = { "short": 0, "medium": 0, "long": 0 };
            }
        } catch (e) {
            resetProfile(); // If the notebook is unreadable, throw it away and get a new one
        }
    }
    return userProfile; // Hand the notebook back to the app to use
}

// Instruction: Put the notebook back in the drawer
function saveProfile() {
    // Turn the notebook into text and shove it in the browser's drawer
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userProfile));
}


export function toggleSave(anime, listName) {
    console.log("🟢 [toggleSave] STARTED for:", anime.title || anime.mal_id);
    console.log("🟢 [toggleSave] Target List:", listName);

    const isWatched = listName === 'watchedList';
    const weight = isWatched ? 2 : 5;
    const profileKey = isWatched ? 'watched' : 'wantToWatch';

    const allTags = [
        ...(anime.genres || []),
        ...(anime.themes || []),
        ...(anime.demographics || [])
    ];

    const safeAnimeId = Number(anime.mal_id || anime.malId);
    console.log("🟢 [toggleSave] ID being checked:", safeAnimeId);

    const isAlreadySaved = userProfile[profileKey].some(id => Number(id) === safeAnimeId);
    console.log("🟢 [toggleSave] Is it already in profile?", isAlreadySaved);

    if (isAlreadySaved) {
        // --- REMOVE ---
        console.log("🔴 [toggleSave] Removing from profile...");
        userProfile[profileKey] = userProfile[profileKey].filter(id => Number(id) !== safeAnimeId);

        try {
            removeGenreStats(allTags, weight);
            removeLengthStats(anime.episodes || 0, weight);
            console.log("🔴 [toggleSave] Math deducted successfully.");
        } catch (error) {
            console.error("❌ ERROR inside remove stats functions:", error);
        }

        let list = JSON.parse(localStorage.getItem(listName)) || [];
        list = list.filter(a => Number(a.mal_id || a.malId) !== safeAnimeId);
        localStorage.setItem(listName, JSON.stringify(list));
        console.log("🔴 [toggleSave] Removed from LocalStorage List.");
    } else {
        // --- ADD ---
        console.log("🔵 [toggleSave] Adding to profile...");
        userProfile[profileKey].push(safeAnimeId);

        try {
            updateGenreStats(allTags, weight);
            updateLengthStats(anime.episodes || 0, weight);
            console.log("🔵 [toggleSave] Math added successfully.");
        } catch (error) {
            console.error("❌ ERROR inside update stats functions:", error);
        }

        let list = JSON.parse(localStorage.getItem(listName)) || [];
        list.push(anime);
        localStorage.setItem(listName, JSON.stringify(list));
        console.log("🔵 [toggleSave] Added to LocalStorage List.");
    }

    try {
        saveProfile();
        console.log("🟢 [toggleSave] Profile saved successfully! Current Profile:", userProfile);
    } catch (error) {
        console.error("❌ ERROR inside saveProfile function:", error);
    }

    return !isAlreadySaved;
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
    if (!genres || !Array.isArray(genres)) return; // If there are no genres, stop.

    genres.forEach(g => { // Look at every genre the show has
        if (g && g.name) {
            // If we haven't seen this genre before, start it at 0
            if (!userProfile.genrePreferences[g.name]) userProfile.genrePreferences[g.name] = 0;

            // Add the points (the "weight")
            userProfile.genrePreferences[g.name] += weight;
        }
    });
}

// Instruction: Add points to the Length Scoreboard
function updateLengthStats(episodes, weight) {
    // If episodes is null/0 (ongoing/unknown), we just skip it
    if (!episodes || episodes === 0) return;

    // Add points to the right category based on episode count
    if (episodes <= 13) userProfile.lengthPreferences["short"] += weight;
    else if (episodes <= 26) userProfile.lengthPreferences["medium"] += weight;
    else userProfile.lengthPreferences["long"] += weight;
}


// 5. Getters for the Algorithm
export const getGenrePreferences = () => userProfile.genrePreferences;
export const getLengthPreferences = () => userProfile.lengthPreferences;

// Instruction: Tell the app which shows to hide (ones we already know about)
export function getExcludedIds() {
    // Combine both lists and remove any duplicates
    return [...new Set([...userProfile.watched, ...userProfile.wantToWatch])];
}

// Instruction: Destroy the notebook and start over
export function resetProfile() {
    localStorage.removeItem(STORAGE_KEY); // Delete it from the drawer
    location.reload(); // Refresh the web page
}

// The very first thing the app does: open the drawer and load the notebook!
loadUserProfile();