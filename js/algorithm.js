// algorithm.js
// ROLE: The Advanced Brain - Calculates suggestions using Tags, Length, and MAL Rating

export function calculateRecommendations(candidateAnimes, userProfile) {
    const { genrePreferences, lengthPreferences } = userProfile;

    const scoredList = candidateAnimes.map(anime => {
        let baseScore = 0;

        // --- FACTOR 1: UNIFIED TAGS (Genres + Themes + Demographics) ---
        // Combine all descriptive arrays Jikan gives us into one list
        const allTags = [
            ...(anime.genres || []),
            ...(anime.themes || []),
            ...(anime.demographics || [])
        ];

        if (allTags.length > 0) {
            allTags.forEach(tag => {
                if (genrePreferences[tag.name]) {
                    baseScore += genrePreferences[tag.name];
                }
            });
                        baseScore = baseScore / allTags.length; 
        }

        // --- FACTOR 2: LENGTH PREFERENCE ---
        const epCount = anime.episodes || 0;
        let lengthCategory = "unknown";
        
        if (epCount > 0 && epCount <= 13) lengthCategory = "short";
        else if (epCount > 13 && epCount <= 26) lengthCategory = "medium";
        else if (epCount > 26) lengthCategory = "long";

        if (lengthPreferences[lengthCategory]) {
            baseScore += (lengthPreferences[lengthCategory] * 1.5); 
        }

        // --- FACTOR 3: QUALITY MULTIPLIER (The Game Changer) ---
        // Jikan provides 'anime.score' (e.g., 8.5). If unranked, default to 5.0.
        const malRating = anime.score || 5.0; 
        
        // Multiply their personal match score by the MAL quality rating percentage
        const finalScore = baseScore * (malRating / 10);

        return {
            ...anime,
            matchScore: Math.round(finalScore), // The new, highly accurate score
            malRating: malRating // Keep this to show on the UI later
        };
    });

    // Sort the list from Highest Final Score to Lowest
    return scoredList.sort((a, b) => b.matchScore - a.matchScore);
}