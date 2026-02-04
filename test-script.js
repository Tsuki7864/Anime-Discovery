const axios = require('axios');
const readline = require('readline');
const crypto = require('crypto');

// --- CONFIGURATION ---
const CLIENT_ID = '8dfc1bd7c58423da78a6ed5ba14da113';         // <--- FILL THIS IN
const CLIENT_SECRET = '2b6dc332cb1730c1e3a7203e4ae4d4ded6efa422ef0e01d9e26a57704ac863fa'; // <--- FILL THIS IN
const ACCESS_TOKEN = 'PASTE_TOKEN_HERE';         // <--- Fill this in AFTER running auth


// --- PART 1: SEARCH ---
async function searchAnime() {
    try {
        const response = await axios.get('https://api.myanimelist.net/v2/anime', {
            headers: { 'X-MAL-CLIENT-ID': CLIENT_ID },
            params: { q: 'Jujutsu Kaisen', limit: 5 }
        });

        response.data.data.forEach(anime => {
            console.log(`ID: ${anime.node.id} | Title: ${anime.node.title}`);
        });
    } catch (error) {
        console.error('Search Error:', error.message);
    }
}


// --- PART 2: AUTHENTICATION (Run this once to get token) ---
async function getAccessToken() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const codeVerifier = crypto.randomBytes(64).toString('hex'); 
    const authUrl = `https://myanimelist.net/v1/oauth2/authorize?response_type=code&client_id=${CLIENT_ID}&code_challenge=${codeVerifier}&state=RequestID42`;

    console.log("1. Open this URL: " + authUrl);
    console.log("2. After authorizing, copy the URL from the broken page.");

    rl.question('\nPaste URL here: ', async (redirectUrl) => {
        try {
            const urlObj = new URL(redirectUrl);
            const code = urlObj.searchParams.get('code');

            const params = new URLSearchParams();
            params.append('client_id', CLIENT_ID);
            params.append('client_secret', CLIENT_SECRET);
            params.append('code', code);
            params.append('code_verifier', codeVerifier);
            params.append('grant_type', 'authorization_code');

            const response = await axios.post('https://myanimelist.net/v1/oauth2/token', params);
            console.log("\n8dfc1bd7c58423da78a6ed5ba14da113", response.data.access_token);
        } catch (error) {
            console.error('Auth Error:', error.message);
        }
        rl.close();
    });
}


// --- PART 3: UPDATE LIST (Requires Access Token) ---
async function updateList() {
    // Check if token is still the placeholder
    if (ACCESS_TOKEN === '8dfc1bd7c58423da78a6ed5ba14da113E') {
        console.log("Error: You need to paste your Access Token at the top of the file first!");
        return;
    }

    const animeId = 52991; // Frieren
    const data = new URLSearchParams();
    data.append('status', 'watching');
    data.append('score', 10);
    data.append('num_watched_episodes', 5);

    try {
        // FIXED: Changed 'internetHelper' to 'axios'
        const response = await axios.put(`https://api.myanimelist.net/v2/anime/${animeId}/my_list_status`, data, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        console.log("List updated!", response.data);
    } catch (error) {
        console.error('Update Error:', error.response ? error.response.data : error.message);
    }
}

// --- MAIN EXECUTION ---
// ONLY UNCOMMENT THE ONE YOU WANT TO RUN:

searchAnime();      // Run this to test searching
// getAccessToken();   // Run this to get your login token
// updateList();       // Run this to update your list (needs token)