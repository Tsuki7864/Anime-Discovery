// ui.js
// ROLE: Frontend Presentation - Handles rendering HTML to the screen cleanly.

// TWEAK AREA 1: Fallback Image
// If an anime has no poster, this image is used. You could replace this URL 
// with a custom branded logo for "Anime Discovery".
const PLACEHOLDER_IMG = 'https://via.placeholder.com/225x318?text=No+Image';

/**
 * Renders anime cards to a specific container on the screen.
 * @param {Array} animeList - The array of anime objects to draw.
 * @param {String} containerSelector - The ID of the HTML div (default is #anime-grid).
 * @param {Boolean} isListView - Set to true if rendering the user's saved lists.
 */
export function renderAnimeCards(animeList, containerSelector = '#anime-grid', isListView = false) {
    const resultsContainer = document.querySelector(containerSelector);
    if (!resultsContainer) return;

    // Clear the grid before adding new ones
    resultsContainer.innerHTML = '';

    // TWEAK AREA 2: Empty States
    // What the user sees if a search fails or their list is empty.
    if (!animeList || animeList.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <p>${isListView ? "This list is empty!" : "No anime found. Try another search!"}</p>
            </div>`;
        return;
    }

    animeList.forEach(anime => {
        // 1. DATA PREP: Combine tags so the backend gets the full payload when clicked
        const allTags = [
            ...(anime.genres || []),
            ...(anime.themes || []),
            ...(anime.demographics || [])
        ];
        const tagsJson = JSON.stringify(allTags).replace(/"/g, '&quot;');

        const imgUrl = anime.images?.jpg?.image_url || PLACEHOLDER_IMG;
        const epText = anime.episodes ? `${anime.episodes} Episodes` : 'Ongoing';

        // 2. BUILD THE HTML STRUCTURE
        const card = document.createElement('div');

        // TWEAK AREA 3: Dynamic CSS Classes
        // This gives you the power to write different CSS for search results vs list items
        card.className = isListView ? 'anime-card list-mode' : 'anime-card search-mode';

        // TWEAK AREA 4: Dynamic Buttons
        let buttonHTML = '';

        if (isListView) {
            buttonHTML = `
                <button class="btn-mal" onclick="window.open('${anime.url}', '_blank')">🌐 MAL</button>
                <button class="btn-remove" data-id="${anime.mal_id}">❌ Remove</button>
            `;
        } else {
            // TWEAK: Added the MAL, Bookmark, and History icons
            buttonHTML = `
                <button class="btn-mal" onclick="window.open('${anime.url}', '_blank')">🌐 MAL</button>
                <button class="btn-want" data-id="${anime.mal_id}" data-episodes="${anime.episodes || 0}" data-title="${anime.title}" data-genres="${tagsJson}">🔖 To Watch</button>
                <button class="btn-watched" data-id="${anime.mal_id}" data-episodes="${anime.episodes || 0}" data-title="${anime.title}" data-genres="${tagsJson}">🕒 Watched</button>
            `;
        }

        // TWEAK AREA 5: The HTML Template
        // Notice the loading="lazy" attribute on the image. This makes your site incredibly fast!
        // Notice the title="${anime.title}" on the h3. If you use CSS to truncate long titles with "...", 
        // the user can still hover over it to read the full name.
        card.innerHTML = `
            <div class="card-image-wrapper">
                <img src="${imgUrl}" alt="${anime.title}" loading="lazy">
            </div>
            <div class="card-content">
                <h3 class="anime-title" title="${anime.title}">${anime.title}</h3>
                <p class="anime-meta">${epText}</p>
                ${anime.matchScore ? `<p class="match-score"><strong>Match Score: ${anime.matchScore}</strong></p>` : ''}
            </div>
            <div class="btn-group">
                ${buttonHTML}
            </div>
        `;

        resultsContainer.appendChild(card);
    });
}

// Controls the loading spinner
export function toggleLoading(isShowing) {
    const overlay = document.querySelector('#loading-overlay');
    if (overlay) {
        overlay.style.display = isShowing ? 'flex' : 'none';
    }
}