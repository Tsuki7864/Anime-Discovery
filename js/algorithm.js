// --- THE REAL algorithm.js ---

export function calculateRecommendations(candidates, userProfile) {
    const { genrePreferences, lengthPreferences } = userProfile;

    // Loop through every anime Jikan gave us and score it
    const scoredAnime = candidates.map(anime => {
        let matchScore = 0;

        // 1. SCORE THE GENRES
        // Combine genres, themes, and demographics into one list
        const allTags = [
            ...(anime.genres || []),
            ...(anime.themes || []),
            ...(anime.demographics || [])
        ];

        // Check if the anime has tags the user likes
        allTags.forEach(tag => {
            if (tag && tag.name && genrePreferences[tag.name]) {
                // If they have "Action" worth 5 points, add 5 to the score!
                matchScore += genrePreferences[tag.name];
            }
        });

        // 2. SCORE THE LENGTH
        const eps = anime.episodes;
        if (eps && eps > 0) {
            if (eps <= 13 && lengthPreferences["short"]) {
                matchScore += lengthPreferences["short"];
            } else if (eps > 13 && eps <= 26 && lengthPreferences["medium"]) {
                matchScore += lengthPreferences["medium"];
            } else if (eps > 26 && lengthPreferences["long"]) {
                matchScore += lengthPreferences["long"];
            }
        }

        // Return the anime with its new calculated score attached
        return { ...anime, matchScore };
    });

    // 3. SORT BY HIGHEST SCORE
    // Filter out anything that scored 0 (no matches), then sort highest to lowest
    return scoredAnime
        .filter(anime => anime.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore);
}