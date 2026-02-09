/**
 * ANIME DISCOVERY ENGINE - HEADLESS MODE
 * Focus: Data Flow & Algorithm Verification
 * Output: Console Logs only
 */

const BASE_URL = "https://api.jikan.moe/v4";

// --- 1. UTILITY: Rate Limiter ---
// Jikan allows 3 requests per second. We pause 500ms between calls to be safe.
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- 2. API: Fetch Data ---
async function fetchFromJikan(endpoint) {
    await delay(600); // Throttling
    console.log(`[API] Fetching: ${endpoint}...`);
    
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        return data.data; // Jikan returns data inside a "data" property
    } catch (error) {
        console.error("Fetch Failed:", error);
        return [];
    }
}