// algorithm.js
// ROLE: The Brain - Calculates how much an anime matches the user's profile

export function calculateRecommendations(candidateAnimes, userProfile) {
    const { genrePreferences, lengthPreferences } = userProfile;

    // 1. Loop through the pool of new animes
    const scoredList = candidateAnimes.map(anime => {
        let score = 0;

        // --- FACTOR 1: GENRES ---
        if (anime.genres) {
            anime.genres.forEach(genre => {
                // If the user has points for this genre, add them to the score!
                if (genrePreferences[genre.name]) {
                    score += genrePreferences[genre.name];
                }
            });
        }

        // --- FACTOR 2: LENGTH ---
        const epCount = anime.episodes || 0; // Fallback to 0 if unknown
        let lengthCategory = "unknown";
        
        if (epCount > 0 && epCount <= 13) lengthCategory = "short";
        else if (epCount > 13 && epCount <= 26) lengthCategory = "medium";
        else if (epCount > 26) lengthCategory = "long";

        // If the user likes this length, give a 1.5x multiplier bonus to their length preference score
        if (lengthPreferences[lengthCategory]) {
            score += (lengthPreferences[lengthCategory] * 1.5); 
        }

        // 2. Return the anime with its new calculated score
        return {
            ...anime,
            matchScore: Math.round(score) // Keep the number clean
        };
    });

    // 3. Sort the list from Highest Score to Lowest Score
    return scoredList.sort((a, b) => b.matchScore - a.matchScore);
}