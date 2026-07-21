/* ========================================
   CineScope — Application Logic
   ======================================== */

// --- Constants ---
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p';
const IMG_SIZES = {
    poster: `${IMG_BASE}/w500`,
    backdrop: `${IMG_BASE}/w1280`,
    profile: `${IMG_BASE}/w185`,
    posterSmall: `${IMG_BASE}/w342`,
    original: `${IMG_BASE}/original`,
};
const PLACEHOLDER_POSTER = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" fill="#1a1a1a"><rect width="500" height="750"/><text x="250" y="375" fill="#5a5550" font-family="sans-serif" font-size="20" text-anchor="middle">No Image</text></svg>')}`;
const PLACEHOLDER_PROFILE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="185" height="185" fill="#1a1a1a"><rect width="185" height="185"/><text x="92" y="100" fill="#5a5550" font-family="sans-serif" font-size="14" text-anchor="middle">?</text></svg>')}`;

// --- State ---
let API_KEY = 'eea8978d5fdf3a39605a96b69fc2e0c2';
let genres = {};
let searchPage = 1;
let searchQuery = '';
let currentSpotlightId = null;
let searchDebounce = null;

// --- DOM Elements ---
const $ = (id) => document.getElementById(id);

const dom = {
    loadingOverlay: $('loading-overlay'),
    apiModalOverlay: $('api-modal-overlay'),
    apiKeyInput: $('api-key-input'),
    apiKeySubmit: $('api-key-submit'),
    navbar: $('navbar'),
    navSearchInput: $('nav-search-input'),
    searchInput: $('search-input'),
    searchBtn: $('search-btn'),
    searchSuggestions: $('search-suggestions'),
    heroGenres: $('hero-genres'),
    spotlightCard: $('spotlight-card'),
    spotlightBackdrop: $('spotlight-backdrop'),
    spotlightTitle: $('spotlight-title'),
    spotlightMeta: $('spotlight-meta'),
    spotlightOverview: $('spotlight-overview'),
    spotlightPoster: $('spotlight-poster'),
    spotlightDetailsBtn: $('spotlight-details-btn'),
    spotlightTrailerBtn: $('spotlight-trailer-btn'),
    trendingMovies: $('trending-movies'),
    topratedMovies: $('toprated-movies'),
    upcomingMovies: $('upcoming-movies'),
    searchResultsSection: $('search-results-section'),
    searchResultsTitle: $('search-results-title'),
    searchResultsSubtitle: $('search-results-subtitle'),
    searchResultsGrid: $('search-results-grid'),
    clearSearchBtn: $('clear-search-btn'),
    loadMoreBtn: $('load-more-btn'),
    loadMoreContainer: $('load-more-container'),
    modalOverlay: $('modal-overlay'),
    movieModal: $('movie-modal'),
    modalClose: $('modal-close'),
    modalBackdrop: $('modal-backdrop'),
    modalPoster: $('modal-poster'),
    modalRating: $('modal-rating'),
    modalTitle: $('modal-title'),
    modalTagline: $('modal-tagline'),
    modalMeta: $('modal-meta'),
    modalGenres: $('modal-genres'),
    modalOverview: $('modal-overview'),
    modalDetailsGrid: $('modal-details-grid'),
    modalCast: $('modal-cast'),
    modalCastSection: $('modal-cast-section'),
    modalSimilar: $('modal-similar'),
    modalSimilarSection: $('modal-similar-section'),
    trailerOverlay: $('trailer-overlay'),
    trailerClose: $('trailer-close'),
    trailerContainer: $('trailer-container'),
};

// --- API ---
async function tmdbFetch(endpoint, params = {}) {
    const url = new URL(`${TMDB_BASE}${endpoint}`);
    url.searchParams.set('api_key', API_KEY);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB API Error: ${res.status}`);
    return res.json();
}

async function fetchGenres() {
    const data = await tmdbFetch('/genre/movie/list');
    data.genres.forEach(g => genres[g.id] = g.name);
}

function getGenreNames(ids = []) {
    return ids.map(id => genres[id]).filter(Boolean);
}

// --- Render ---
function createMovieCard(movie, index = 0) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.style.animationDelay = `${index * 0.04}s`;

    const posterUrl = movie.poster_path ? `${IMG_SIZES.poster}${movie.poster_path}` : PLACEHOLDER_POSTER;
    const year = (movie.release_date || '').substring(0, 4);
    const rating = (movie.vote_average || 0).toFixed(1);

    card.innerHTML = `
        <div class="movie-card-poster">
            <img src="${posterUrl}" alt="${movie.title}" loading="lazy">
            <div class="movie-card-rating">${rating}</div>
        </div>
        <div class="movie-card-info">
            <div class="movie-card-title">${movie.title}</div>
            <div class="movie-card-year">${year}</div>
        </div>
    `;

    card.addEventListener('click', () => openMovieModal(movie.id));
    return card;
}

function renderCarousel(containerId, movies) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    movies.forEach((movie, i) => {
        container.appendChild(createMovieCard(movie, i));
    });
}

// --- Carousel Scroll ---
function setupCarousel(rowId, prevId, nextId) {
    const row = document.getElementById(rowId);
    const prev = document.getElementById(prevId);
    const next = document.getElementById(nextId);
    const scrollAmount = 620;

    prev.addEventListener('click', () => row.scrollBy({ left: -scrollAmount, behavior: 'smooth' }));
    next.addEventListener('click', () => row.scrollBy({ left: scrollAmount, behavior: 'smooth' }));
}

// --- Genre Chips ---
function renderGenreChips() {
    const popular = [28, 35, 18, 27, 878, 10749, 53, 16, 12, 14];
    dom.heroGenres.innerHTML = '';
    popular.forEach(id => {
        if (genres[id]) {
            const chip = document.createElement('button');
            chip.className = 'genre-chip';
            chip.textContent = genres[id];
            chip.addEventListener('click', () => searchByGenre(id, genres[id]));
            dom.heroGenres.appendChild(chip);
        }
    });
}

async function searchByGenre(genreId, genreName) {
    searchQuery = '';
    searchPage = 1;
    dom.searchInput.value = '';
    dom.navSearchInput.value = '';
    dom.searchResultsTitle.textContent = `${genreName} Movies`;
    dom.searchResultsSubtitle.textContent = `Browsing ${genreName.toLowerCase()} films`;

    try {
        const data = await tmdbFetch('/discover/movie', {
            with_genres: genreId,
            sort_by: 'popularity.desc',
            page: 1,
        });
        showSearchResults(data.results, data.total_results, false);
        searchQuery = `genre:${genreId}`;
    } catch (err) {
        console.error('Genre search error:', err);
    }
}

// --- Spotlight ---
async function loadSpotlight() {
    try {
        const data = await tmdbFetch('/trending/movie/day');
        const movie = data.results[0];
        if (!movie) return;
        currentSpotlightId = movie.id;

        if (movie.backdrop_path) {
            dom.spotlightBackdrop.style.backgroundImage = `url(${IMG_SIZES.backdrop}${movie.backdrop_path})`;
            document.querySelector('.hero-bg').style.backgroundImage = `url(${IMG_SIZES.backdrop}${movie.backdrop_path})`;
        }

        dom.spotlightTitle.textContent = movie.title;
        dom.spotlightOverview.textContent = movie.overview;

        const year = (movie.release_date || '').substring(0, 4);
        const rating = (movie.vote_average || 0).toFixed(1);
        dom.spotlightMeta.innerHTML = `
            <span class="meta-item"><strong>${rating}</strong> / 10</span>
            <span class="meta-dot"></span>
            <span class="meta-item">${year}</span>
            <span class="meta-dot"></span>
            <span class="meta-item">${getGenreNames(movie.genre_ids).slice(0, 3).join(', ')}</span>
        `;

        if (movie.poster_path) {
            dom.spotlightPoster.innerHTML = `<img src="${IMG_SIZES.poster}${movie.poster_path}" alt="${movie.title}">`;
        }

        dom.spotlightDetailsBtn.onclick = () => openMovieModal(movie.id);
        dom.spotlightTrailerBtn.onclick = () => playTrailer(movie.id);
    } catch (err) {
        console.error('Spotlight error:', err);
    }
}

// --- Load Sections ---
async function loadTrending(timeWindow = 'day') {
    try {
        const data = await tmdbFetch(`/trending/movie/${timeWindow}`);
        renderCarousel('trending-movies', data.results);
    } catch (err) {
        console.error('Trending error:', err);
    }
}

async function loadTopRated() {
    try {
        const data = await tmdbFetch('/movie/top_rated');
        renderCarousel('toprated-movies', data.results);
    } catch (err) {
        console.error('Top rated error:', err);
    }
}

async function loadUpcoming() {
    try {
        const data = await tmdbFetch('/movie/upcoming');
        renderCarousel('upcoming-movies', data.results);
    } catch (err) {
        console.error('Upcoming error:', err);
    }
}

// --- Search ---
async function performSearch(query, page = 1) {
    if (!query.trim()) return;
    searchQuery = query;
    searchPage = page;

    try {
        const data = await tmdbFetch('/search/movie', { query, page });
        dom.searchResultsTitle.textContent = 'Search Results';
        dom.searchResultsSubtitle.textContent = `${data.total_results.toLocaleString()} results for "${query}"`;
        showSearchResults(data.results, data.total_results, page > 1);
    } catch (err) {
        console.error('Search error:', err);
    }
}

function showSearchResults(results, totalResults, append = false) {
    dom.searchResultsSection.classList.remove('hidden');
    document.getElementById('spotlight-section').style.display = 'none';
    document.getElementById('trending-section').style.display = 'none';
    document.getElementById('top-rated-section').style.display = 'none';
    document.getElementById('upcoming-section').style.display = 'none';

    if (!append) {
        dom.searchResultsGrid.innerHTML = '';
    }

    if (results.length === 0 && !append) {
        dom.searchResultsGrid.innerHTML = `
            <div class="no-results" style="grid-column: 1 / -1;">
                <h3>No movies found</h3>
                <p>Try a different search term or browse trending films.</p>
            </div>
        `;
        dom.loadMoreContainer.style.display = 'none';
        return;
    }

    results.forEach((movie, i) => {
        const card = createMovieCard(movie, append ? 0 : i);
        dom.searchResultsGrid.appendChild(card);
    });

    const currentCount = dom.searchResultsGrid.querySelectorAll('.movie-card').length;
    dom.loadMoreContainer.style.display = currentCount < totalResults ? 'block' : 'none';

    if (!append) {
        dom.searchResultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function clearSearch() {
    dom.searchResultsSection.classList.add('hidden');
    document.getElementById('spotlight-section').style.display = '';
    document.getElementById('trending-section').style.display = '';
    document.getElementById('top-rated-section').style.display = '';
    document.getElementById('upcoming-section').style.display = '';
    dom.searchInput.value = '';
    dom.navSearchInput.value = '';
    searchQuery = '';
    searchPage = 1;
}

// --- Suggestions ---
async function fetchSuggestions(query) {
    if (!query.trim() || query.length < 2) {
        dom.searchSuggestions.classList.remove('active');
        return;
    }
    try {
        const data = await tmdbFetch('/search/movie', { query, page: 1 });
        const results = data.results.slice(0, 6);
        if (results.length === 0) {
            dom.searchSuggestions.classList.remove('active');
            return;
        }

        dom.searchSuggestions.innerHTML = results.map(movie => {
            const posterUrl = movie.poster_path ? `${IMG_SIZES.posterSmall}${movie.poster_path}` : PLACEHOLDER_POSTER;
            const year = (movie.release_date || '').substring(0, 4);
            return `
                <div class="suggestion-item" data-id="${movie.id}">
                    <img class="suggestion-poster" src="${posterUrl}" alt="${movie.title}" loading="lazy">
                    <div class="suggestion-info">
                        <div class="suggestion-title">${movie.title}</div>
                        <div class="suggestion-year">${year}</div>
                    </div>
                </div>
            `;
        }).join('');

        dom.searchSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                openMovieModal(parseInt(item.dataset.id));
                dom.searchSuggestions.classList.remove('active');
            });
        });

        dom.searchSuggestions.classList.add('active');
    } catch (err) {
        console.error('Suggestions error:', err);
    }
}

// --- Movie Modal ---
async function openMovieModal(movieId) {
    dom.modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    try {
        const [movie, credits, similar, videos] = await Promise.all([
            tmdbFetch(`/movie/${movieId}`),
            tmdbFetch(`/movie/${movieId}/credits`),
            tmdbFetch(`/movie/${movieId}/similar`),
            tmdbFetch(`/movie/${movieId}/videos`),
        ]);

        // Backdrop
        if (movie.backdrop_path) {
            dom.modalBackdrop.style.backgroundImage = `url(${IMG_SIZES.backdrop}${movie.backdrop_path})`;
        } else {
            dom.modalBackdrop.style.backgroundImage = 'none';
            dom.modalBackdrop.style.background = 'var(--bg-card)';
        }

        // Poster
        dom.modalPoster.src = movie.poster_path ? `${IMG_SIZES.poster}${movie.poster_path}` : PLACEHOLDER_POSTER;
        dom.modalPoster.alt = movie.title;

        // Rating
        dom.modalRating.textContent = (movie.vote_average || 0).toFixed(1);

        // Title & Tagline
        dom.modalTitle.textContent = movie.title;
        dom.modalTagline.textContent = movie.tagline || '';
        dom.modalTagline.style.display = movie.tagline ? 'block' : 'none';

        // Meta
        const year = (movie.release_date || '').substring(0, 4);
        const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : '';
        const metaParts = [year, runtime, movie.original_language?.toUpperCase()].filter(Boolean);
        dom.modalMeta.innerHTML = metaParts.map((p, i) => `
            ${i > 0 ? '<span class="meta-dot"></span>' : ''}
            <span class="meta-item">${p}</span>
        `).join('');

        // Genres
        dom.modalGenres.innerHTML = (movie.genres || []).map(g =>
            `<span class="modal-genre-tag">${g.name}</span>`
        ).join('');

        // Overview
        dom.modalOverview.textContent = movie.overview || 'No overview available.';

        // Details Grid
        const details = [];
        if (movie.status) details.push({ label: 'Status', value: movie.status });
        if (movie.budget) details.push({ label: 'Budget', value: `$${(movie.budget / 1e6).toFixed(0)}M` });
        if (movie.revenue) details.push({ label: 'Revenue', value: `$${(movie.revenue / 1e6).toFixed(0)}M` });
        if (movie.vote_count) details.push({ label: 'Votes', value: movie.vote_count.toLocaleString() });
        if (credits.crew) {
            const director = credits.crew.find(c => c.job === 'Director');
            if (director) details.push({ label: 'Director', value: director.name });
        }
        if (movie.production_companies?.length) {
            details.push({ label: 'Studio', value: movie.production_companies[0].name });
        }

        dom.modalDetailsGrid.innerHTML = details.map(d => `
            <div class="detail-item">
                <div class="detail-label">${d.label}</div>
                <div class="detail-value">${d.value}</div>
            </div>
        `).join('');

        // Cast
        const cast = (credits.cast || []).slice(0, 10);
        if (cast.length) {
            dom.modalCastSection.style.display = 'block';
            dom.modalCast.innerHTML = cast.map(c => `
                <div class="cast-item">
                    <img class="cast-avatar" src="${c.profile_path ? IMG_SIZES.profile + c.profile_path : PLACEHOLDER_PROFILE}" alt="${c.name}" loading="lazy">
                    <div class="cast-name">${c.name}</div>
                    <div class="cast-character">${c.character || ''}</div>
                </div>
            `).join('');
        } else {
            dom.modalCastSection.style.display = 'none';
        }

        // Similar
        const similarMovies = (similar.results || []).slice(0, 8);
        if (similarMovies.length) {
            dom.modalSimilarSection.style.display = 'block';
            dom.modalSimilar.innerHTML = similarMovies.map(m => `
                <div class="similar-item" data-id="${m.id}">
                    <img class="similar-poster" src="${m.poster_path ? IMG_SIZES.posterSmall + m.poster_path : PLACEHOLDER_POSTER}" alt="${m.title}" loading="lazy">
                    <div class="similar-title">${m.title}</div>
                </div>
            `).join('');

            dom.modalSimilar.querySelectorAll('.similar-item').forEach(item => {
                item.addEventListener('click', () => {
                    dom.modalOverlay.scrollTo({ top: 0, behavior: 'smooth' });
                    openMovieModal(parseInt(item.dataset.id));
                });
            });
        } else {
            dom.modalSimilarSection.style.display = 'none';
        }

        // Store trailer info
        const trailer = (videos.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube');
        dom.movieModal.dataset.trailerId = trailer ? trailer.key : '';

    } catch (err) {
        console.error('Modal error:', err);
        closeMovieModal();
    }
}

function closeMovieModal() {
    dom.modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

// --- Trailer ---
async function playTrailer(movieId) {
    try {
        let trailerKey = '';

        if (dom.movieModal.dataset.trailerId) {
            trailerKey = dom.movieModal.dataset.trailerId;
        } else {
            const data = await tmdbFetch(`/movie/${movieId}/videos`);
            const trailer = (data.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube');
            if (trailer) trailerKey = trailer.key;
        }

        if (trailerKey) {
            dom.trailerContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
            dom.trailerOverlay.classList.add('active');
        } else {
            alert('No trailer available for this movie.');
        }
    } catch (err) {
        console.error('Trailer error:', err);
    }
}

function closeTrailer() {
    dom.trailerOverlay.classList.remove('active');
    dom.trailerContainer.innerHTML = '';
}

// --- Event Listeners ---
function setupEventListeners() {
    // Navbar scroll
    window.addEventListener('scroll', () => {
        dom.navbar.classList.toggle('scrolled', window.scrollY > 50);
    });

    // Hero search
    dom.searchBtn.addEventListener('click', () => {
        performSearch(dom.searchInput.value);
        dom.searchSuggestions.classList.remove('active');
    });
    dom.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            performSearch(dom.searchInput.value);
            dom.searchSuggestions.classList.remove('active');
        }
    });
    dom.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => fetchSuggestions(e.target.value), 300);
    });

    // Nav search
    dom.navSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            performSearch(dom.navSearchInput.value);
            dom.searchInput.value = dom.navSearchInput.value;
        }
    });

    // Close suggestions on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.hero-search')) {
            dom.searchSuggestions.classList.remove('active');
        }
    });

    // Clear search
    dom.clearSearchBtn.addEventListener('click', clearSearch);

    // Load more
    dom.loadMoreBtn.addEventListener('click', async () => {
        searchPage++;
        if (searchQuery.startsWith('genre:')) {
            const genreId = searchQuery.replace('genre:', '');
            const data = await tmdbFetch('/discover/movie', {
                with_genres: genreId,
                sort_by: 'popularity.desc',
                page: searchPage,
            });
            showSearchResults(data.results, data.total_results, true);
        } else {
            performSearch(searchQuery, searchPage);
        }
    });

    // Trending tabs
    $('trending-day-tab').addEventListener('click', function () {
        this.classList.add('active');
        $('trending-week-tab').classList.remove('active');
        loadTrending('day');
    });
    $('trending-week-tab').addEventListener('click', function () {
        this.classList.add('active');
        $('trending-day-tab').classList.remove('active');
        loadTrending('week');
    });

    // Modal
    dom.modalClose.addEventListener('click', closeMovieModal);
    dom.modalOverlay.addEventListener('click', (e) => {
        if (e.target === dom.modalOverlay) closeMovieModal();
    });

    // Trailer
    dom.trailerClose.addEventListener('click', closeTrailer);
    dom.trailerOverlay.addEventListener('click', (e) => {
        if (e.target === dom.trailerOverlay) closeTrailer();
    });

    // Spotlight trailer button
    dom.spotlightTrailerBtn.addEventListener('click', () => {
        if (currentSpotlightId) playTrailer(currentSpotlightId);
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (dom.trailerOverlay.classList.contains('active')) closeTrailer();
            else if (dom.modalOverlay.classList.contains('active')) closeMovieModal();
        }
    });

    // Nav links
    document.querySelectorAll('.nav-link[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            clearSearch();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const section = link.dataset.section;
            if (section === 'home') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (section === 'trending') {
                $('trending-section').scrollIntoView({ behavior: 'smooth' });
            } else if (section === 'top-rated') {
                $('top-rated-section').scrollIntoView({ behavior: 'smooth' });
            } else if (section === 'upcoming') {
                $('upcoming-section').scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Logo click
    $('logo').addEventListener('click', (e) => {
        e.preventDefault();
        clearSearch();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// --- Carousels ---
function setupCarousels() {
    setupCarousel('trending-movies', 'trending-prev', 'trending-next');
    setupCarousel('toprated-movies', 'toprated-prev', 'toprated-next');
    setupCarousel('upcoming-movies', 'upcoming-prev', 'upcoming-next');
}

// --- API Key Flow ---
function setupApiKeyFlow() {
    if (API_KEY) {
        dom.apiModalOverlay.classList.add('fade-out');
        initApp();
        return;
    }

    dom.loadingOverlay.classList.add('fade-out');

    dom.apiKeySubmit.addEventListener('click', submitApiKey);
    dom.apiKeyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitApiKey();
    });
}

async function submitApiKey() {
    const key = dom.apiKeyInput.value.trim();
    if (!key) {
        dom.apiKeyInput.style.borderColor = 'var(--accent-red)';
        return;
    }

    dom.apiKeySubmit.textContent = 'Verifying...';
    dom.apiKeySubmit.disabled = true;

    try {
        const url = new URL(`${TMDB_BASE}/movie/popular`);
        url.searchParams.set('api_key', key);
        const res = await fetch(url);
        if (!res.ok) throw new Error('Invalid key');

        API_KEY = key;
        localStorage.setItem('tmdb_api_key', key);
        dom.apiModalOverlay.classList.add('fade-out');

        dom.loadingOverlay.classList.remove('fade-out');
        await initApp();
    } catch (err) {
        dom.apiKeyInput.style.borderColor = 'var(--accent-red)';
        dom.apiKeySubmit.textContent = 'Invalid key — try again';
        dom.apiKeySubmit.disabled = false;
        setTimeout(() => {
            dom.apiKeySubmit.textContent = 'Continue';
        }, 2000);
    }
}

// --- Init ---
async function initApp() {
    try {
        await fetchGenres();
        renderGenreChips();
        setupEventListeners();
        setupCarousels();

        await Promise.all([
            loadSpotlight(),
            loadTrending('day'),
            loadTopRated(),
            loadUpcoming(),
        ]);
    } catch (err) {
        console.error('Init error:', err);
    } finally {
        setTimeout(() => {
            dom.loadingOverlay.classList.add('fade-out');
        }, 400);
    }
}

// --- Start ---
document.addEventListener('DOMContentLoaded', setupApiKeyFlow);
