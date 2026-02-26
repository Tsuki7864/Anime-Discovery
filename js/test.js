// --- DEBUG TOOL: TEST JIKAN DATA ---
async function testJikanData() {
    console.log("Backend Test: Fetching data for 'Attack on Titan' (ID: 16498)...");
    try {
        const response = await fetch("https://api.jikan.moe/v4/anime/16498");
        const result = await response.json();
        const anime = result.data;

        console.log("Fetch Successful! Here is the isolated data:");
        console.log("Title:", anime.title);
        console.log("Episodes:", anime.episodes);
        
        // Extract just the genre names so they are easy to read
        const genreNames = anime.genres.map(g => g.name);
        console.log("Genre Names:", genreNames);
        console.log("Raw Genre Array (What the algorithm sees):", anime.genres);

    } catch (error) {
        console.error("Test failed:", error);
    }
}

// Run the test immediately when the page loads
testJikanData();