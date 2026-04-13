// algorithm.js
export function calculateRecommendations(candidates, userProfile) {
    const genrePrefs = userProfile.genrePreferences || {};
    const lengthPrefs = userProfile.lengthPreferences || {};

    // 1. Find the user's top 2 favorite genres
    const genreArray = Object.entries(genrePrefs);
    genreArray.sort((a, b) => b[1] - a[1]); // Sort highest to lowest

    // Only grab genres that actually have points (> 0)
    const topGenres = genreArray.filter(g => g[1] > 0).slice(0, 2).map(g => g[0]);

    let maxRawScore = 1; // Prevents division by zero later

    // --- STEP 1: Calculate raw scores for everyone ---
    candidates.forEach(anime => {
        let score = 0;
        let hasDominantGenre = false;

        // 2. Gather all tags and DEDUPLICATE them so the API doesn't cheat the math
        const rawTags = [
            ...(anime.genres || []),
            ...(anime.themes || []),
            ...(anime.demographics || [])
        ];

        // This removes duplicate tags (e.g., if it's listed as a genre AND a theme)
        const uniqueTags = [...new Map(rawTags.map(tag => [tag.name, tag])).values()];

        // 3. Calculate Genre Points
        uniqueTags.forEach(tag => {
            if (tag && tag.name && genrePrefs[tag.name]) {
                score += genrePrefs[tag.name];

                // Flag if this anime contains one of their absolute favorite genres
                if (topGenres.includes(tag.name)) {
                    hasDominantGenre = true;
                }
            }
        });

        // 4. Calculate Length Points
        const episodes = anime.episodes || 0;
        let lengthCategory = "long";
        if (episodes > 0 && episodes <= 13) lengthCategory = "short";
        else if (episodes > 13 && episodes <= 26) lengthCategory = "medium";

        // Add points if the anime matches their preferred episode length
        if (lengthPrefs[lengthCategory]) {
            score += lengthPrefs[lengthCategory];
        }

        // 5. THE DOMINANT VIBE CHECK (Genre Soup Killer)
        // Only apply this multiplier if the user has actually saved something
        if (topGenres.length > 0) {
            if (hasDominantGenre) {
                score *= 1.5; // Boost! It has their favorite vibe.
            } else {
                score *= 0.2; // Flush! It's missing their favorite vibe.
            }
        }

        anime.rawScore = score;

        // Track the highest score in this batch for our percentage math
        if (score > maxRawScore) {
            maxRawScore = score;
        }
    });

    // --- STEP 2: Convert raw scores to realistic percentages ---
    return candidates.map(anime => {
        let percentage = Math.round((anime.rawScore / maxRawScore) * 100);

        // Cap the percentages so the UI feels authentic and realistic
        if (percentage > 98) percentage = 98;
        if (percentage < 15) percentage = 15;

        anime.matchScore = percentage;
        return anime;
    });
}