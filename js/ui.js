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

        // 2. BUILD THE HTML STRUCTURE
        const card = document.createElement('div');

        // TWEAK AREA 3: Dynamic CSS Classes
        // This gives you the power to write different CSS for search results vs list items
        card.className = isListView ? 'anime-card list-mode' : 'anime-card search-mode';
        // TWEAK AREA 4: Dynamic Buttons (Using the original classes)

        // Grab the aired dates and the synopsis from the API data
        const epText = anime.episodes ? `${anime.episodes} Episodes` : 'Ongoing';
        const airedText = anime.aired && anime.aired.string ? anime.aired.string : 'Unknown Date';
        const synopsisText = anime.synopsis ? anime.synopsis : 'No description available.';
        const safeSynopsis = encodeURIComponent(synopsisText);

        const animeUrl = anime.url ? anime.url : `https://myanimelist.net/anime/${anime.mal_id}`;

        let buttonHTML = '';

        if (isListView) {
            buttonHTML = `
        <button class="remove-btn" data-id="${anime.mal_id ?? anime.malId ?? ''}" data-title="${anime.title}">❌</button>
            `;
        } else {
            // 1. Check the database to see if this anime is already saved
            const watchedList = JSON.parse(localStorage.getItem('watchedList')) || [];
            const wantList = JSON.parse(localStorage.getItem('wantList')) || [];
            const inWatched = watchedList.some(item => item.mal_id === anime.mal_id);
            const inWant = wantList.some(item => item.mal_id === anime.mal_id);

            // 2. Set up the styles and text based on what we found
            const wantStyle = inWatched ? 'style="display: none;"' : '';
            const watchedStyle = inWant ? 'style="display: none;"' : '';

            const wantClass = inWant ? 'btn-want active' : 'btn-want';
            const watchedClass = inWatched ? 'btn-watched active' : 'btn-watched';

            const wantText = inWant ? '★ Added' : '🔖';
            const watchedText = inWatched ? '✓ Saved' : '🕒';

            // 3. Build the buttons with the correct starting states!
            buttonHTML = `
                <button class="${wantClass}" ${wantStyle} data-id="${anime.mal_id}" data-image="${imgUrl}" data-episodes="${anime.episodes || 0}" data-title="${anime.title}" data-genres="${tagsJson}" data-aired="${airedText}" data-synopsis="${safeSynopsis}" data-url="${animeUrl}">${wantText}</button>
                <button class="${watchedClass}" ${watchedStyle} data-id="${anime.mal_id}" data-image="${imgUrl}" data-episodes="${anime.episodes || 0}" data-title="${anime.title}" data-genres="${tagsJson}" data-aired="${airedText}" data-synopsis="${safeSynopsis}" data-url="${animeUrl}">${watchedText}</button>
            `;
        }

        // TWEAK AREA 5: The HTML Template
        card.innerHTML = `
            <a href="${animeUrl}" target="_blank" class="anime-link">
                <img src="${imgUrl}" alt="${anime.title}" loading="lazy">
                
                <div class="anime-overlay">
                    <h3
                    class="anime-title"
                    data-main-title="${anime.title || ''}"
                    data-alt-title="${anime.title_english || anime.title_synonyms?.[0] || ''}"
                    title="${anime.title || ''}"
                    >
                    ${anime.title || ''}
                    </h3>
                    <p class="anime-year">${airedText}</p>
                    <p class="anime-episodes">${epText}</p>
                    <p class="anime-synopsis">${synopsisText}</p>
                    ${anime.matchScore ? `<p style="margin-top: 5px; color: #fbbf24;"><strong>Score: ${anime.matchScore}</strong></p>` : ''}
                </div>
            </a>

            <div class="overlay-buttons">
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