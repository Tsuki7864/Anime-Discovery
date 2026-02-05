const axios = require('axios');

async function testJikanFetch(animeName) {
    console.log(`\n--- Searching Jikan for: "${animeName}" ---`);

    try {
        const url = `https://api.jikan.moe/v4/anime?q=${animeName}&limit=1`;

        const response = await axios.get(url);

        const animeData = response.data.data[0];

        if (animeData) {
            console.log("Found Anime!:");
            console.log("------------------------------------------------");
            console.log(`Title:      ${animeData.title}`);
            console.log(`English:    ${animeData.title_english || "N/A"}`);
            console.log(`Year:       ${animeData.year || "N/A"}`);
            console.log(`Episodes:   ${animeData.episodes || "Unknown"}`);
            console.log(`Synopsis:   ${animeData.synopsis ? animeData.synopsis.substring(0, 100) + "..." : "No synopsis"}`);
            console.log("------------------------------------------------");
        } else {
            console.log("No results found.");
        }

    } catch (error) {
        console.error("Error fetching data:", error.message);
    }
}

// --- RUN THE TEST ---
// You can change 'Naruto' to any anime name you want to test
testJikanFetch('Naruto');