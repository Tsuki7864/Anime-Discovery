// ==========================================
// 1. THE SETUP: GETTING THE BLANK NOTEBOOK
// ==========================================

// The label on the front of our notebook so the browser remembers where it is.
const STORAGE_KEY = 'anime_discovery_profile';

// Our blank notebook with 4 empty sections.
let userProfile = {
    watched: [],       // Empty list for finished shows
    wantToWatch: [],   // Empty list for shows to watch later
    genrePreferences: {}, // Empty scoreboard for genres
    lengthPreferences: { "short": 0, "medium": 0, "long": 0 } // Empty scoreboard for lengths
};


// ==========================================
// 2. THE DRAWER: OPENING & CLOSING THE NOTEBOOK
// ==========================================

// Instruction: Take the notebook out of the drawer
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


// ==========================================
// 3. THE ACTIONS: ADDING SHOWS TO THE LISTS
// ==========================================

// Instruction: User clicked "Want to Watch"
export function addToWantList(anime) {
    // If it is already on the list, do nothing.
    if (userProfile.wantToWatch.includes(anime.mal_id)) return;
    
    // Add the show's ID to the "Want to Watch" list
    userProfile.wantToWatch.push(anime.mal_id);
    
    // Gather all the tags (Action, Sci-Fi, Shounen, etc.)
    const allTags = [...(anime.genres || []), ...(anime.themes || []), ...(anime.demographics || [])];
    
    // Give 5 points to these genres and to the show's length
    updateGenreStats(allTags, 5); 
    updateLengthStats(anime.episodes, 5);
    
    saveProfile(); // Put the notebook back in the drawer
}

// Instruction: User clicked "I've Watched This"
export function addToWatched(anime) {
    // If it is already on the list, do nothing.
    if (userProfile.watched.includes(anime.mal_id)) return;
    
    // Add the show's ID to the "Finished" list
    userProfile.watched.push(anime.mal_id);
    
    // Gather all the tags
    const allTags = [...(anime.genres || []), ...(anime.themes || []), ...(anime.demographics || [])];
    
    // Give 2 points to these genres and the show's length
    updateGenreStats(allTags, 2); 
    updateLengthStats(anime.episodes, 2);
    
    saveProfile(); // Put the notebook back in the drawer
}


// ==========================================
// 4. THE MATH: TALLYING UP THE SCOREBOARDS
// ==========================================

// Instruction: Add points to the Genre Scoreboard
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
    // If we don't know how many episodes it has, skip it.
    if (!episodes || episodes === 0) return; 

    // Add points to the right category based on episode count
    if (episodes <= 13) userProfile.lengthPreferences["short"] += weight;
    else if (episodes <= 26) userProfile.lengthPreferences["medium"] += weight;
    else userProfile.lengthPreferences["long"] += weight;
}


// ==========================================
// 5. READING & TEARING UP THE NOTEBOOK
// ==========================================

// Instruction: Let the app read the scoreboards
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