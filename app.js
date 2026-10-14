/* ========================================
   CineScope — Application Logic
   Powered by OMDB API
   ======================================== */

// --- API Base (use current origin so it works on localhost:3000) ---
const API_BASE = window.location.origin;

// --- Constants ---
const PLACEHOLDER_POSTER = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" fill="#1a1a1a"><rect width="500" height="750"/><text x="250" y="375" fill="#5a5550" font-family="sans-serif" font-size="20" text-anchor="middle">No Image</text></svg>')}`;
const PLACEHOLDER_PROFILE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="185" height="185" fill="#1a1a1a"><rect width="185" height="185"/><text x="92" y="100" fill="#5a5550" font-family="sans-serif" font-size="14" text-anchor="middle">?</text></svg>')}`;

// --- Curated Movie Lists (IMDB IDs) ---
const CURATED = {
    trending: [
        'tt6263850', 'tt1517268', 'tt15398776', 'tt14230458', 'tt11866324',
        'tt13623148', 'tt10676048', 'tt9362722', 'tt5971474', 'tt14539740',
        'tt12037194', 'tt7657566', 'tt21807222', 'tt6710474', 'tt9603212',
        'tt14998742', 'tt13238346', 'tt12747748', 'tt11564570', 'tt8760708'
    ],
    topRated: [
        'tt0111161', 'tt0068646', 'tt0468569', 'tt0071562', 'tt0050083',
        'tt0108052', 'tt0167260', 'tt0110912', 'tt0120737', 'tt0060196',
        'tt0137523', 'tt0109830', 'tt1375666', 'tt0080684', 'tt0167261',
        'tt0133093', 'tt0099685', 'tt0073486', 'tt0076759', 'tt0816692'
    ],
    upcoming: [
        'tt6263850', 'tt13623148', 'tt14539740', 'tt21807222', 'tt14998742',
        'tt13238346', 'tt11564570', 'tt8760708', 'tt10676048', 'tt12037194',
        'tt15398776', 'tt14230458', 'tt11866324', 'tt9362722', 'tt5971474',
        'tt7657566', 'tt6710474', 'tt9603212', 'tt12747748', 'tt1517268'
    ],
};

// --- Genre list (since OMDB doesn't have a genre endpoint) ---
const GENRE_LIST = [
    'Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi',
    'Romance', 'Thriller', 'Animation', 'Adventure', 'Fantasy'
];

// --- State ---
let searchPage = 1;
let searchQuery = '';
let currentSpotlightId = null;
let searchDebounce = null;
let currentUser = null;
let totalSearchResults = 0;

// --- DOM Elements ---
const $ = (id) => document.getElementById(id);

const dom = {
    loadingOverlay: $('loading-overlay'),
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
    // Auth
    navLoginBtn: $('nav-login-btn'),
    navUser: $('nav-user'),
    userAvatarBtn: $('user-avatar-btn'),
    userAvatarLetter: $('user-avatar-letter'),
    userDropdown: $('user-dropdown'),
    dropdownAvatar: $('dropdown-avatar'),
    dropdownName: $('dropdown-name'),
    dropdownEmail: $('dropdown-email'),
    dropdownFavCount: $('dropdown-fav-count'),
    dropdownWatchCount: $('dropdown-watch-count'),
    dropdownFavorites: $('dropdown-favorites'),
    dropdownWatchlist: $('dropdown-watchlist'),
    dropdownLogout: $('dropdown-logout'),
    authOverlay: $('auth-overlay'),
    authModal: $('auth-modal'),
    authClose: $('auth-close'),
    authTabLogin: $('auth-tab-login'),
    authTabRegister: $('auth-tab-register'),
    loginForm: $('login-form'),
    registerForm: $('register-form'),
    loginError: $('login-error'),
    registerError: $('register-error'),
    toastContainer: $('toast-container'),
    // Sections
    favoritesSection: $('favorites-section'),
    favoritesGrid: $('favorites-grid'),
    favoritesSubtitle: $('favorites-subtitle'),
    closeFavoritesBtn: $('close-favorites-btn'),
    watchlistSection: $('watchlist-section'),
    watchlistGrid: $('watchlist-grid'),
    watchlistSubtitle: $('watchlist-subtitle'),
    closeWatchlistBtn: $('close-watchlist-btn'),
};

// =========================================
//  TOAST NOTIFICATIONS
// =========================================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warning' ? '!' : 'ℹ'}</span>
        <span class="toast-msg">${message}</span>
    `;
    dom.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// =========================================
//  AUTH SYSTEM
// =========================================
async function checkAuth() {
    try {
        const res = await fetch(`${API_BASE}/api/me`);
        const data = await res.json();
        if (data.user) {
            currentUser = data.user;
            updateAuthUI(true);
        } else {
            currentUser = null;
            updateAuthUI(false);
        }
    } catch {
        currentUser = null;
        updateAuthUI(false);
    }
}

function updateAuthUI(loggedIn) {
    if (loggedIn && currentUser) {
        dom.navLoginBtn.style.display = 'none';
        dom.navUser.style.display = 'flex';

        const letter = currentUser.username.charAt(0).toUpperCase();
        const color = currentUser.avatar_color || '#c9a96e';

        dom.userAvatarLetter.textContent = letter;
        dom.userAvatarBtn.style.background = color;
        dom.dropdownAvatar.textContent = letter;
        dom.dropdownAvatar.style.background = color;
        dom.dropdownName.textContent = currentUser.username;
        dom.dropdownEmail.textContent = currentUser.email;
        dom.dropdownFavCount.textContent = currentUser.favorites_count || 0;
        dom.dropdownWatchCount.textContent = currentUser.watchlist_count || 0;
    } else {
        dom.navLoginBtn.style.display = '';
        dom.navUser.style.display = 'none';
    }
}

function openAuthModal(tab = 'login') {
    dom.authOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    switchAuthTab(tab);
    // Clear forms
    dom.loginForm.reset();
    dom.registerForm.reset();
    dom.loginError.textContent = '';
    dom.registerError.textContent = '';
}

function closeAuthModal() {
    dom.authOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

function switchAuthTab(tab) {
    if (tab === 'login') {
        dom.authTabLogin.classList.add('active');
        dom.authTabRegister.classList.remove('active');
        dom.loginForm.style.display = '';
        dom.registerForm.style.display = 'none';
    } else {
        dom.authTabLogin.classList.remove('active');
        dom.authTabRegister.classList.add('active');
        dom.loginForm.style.display = 'none';
        dom.registerForm.style.display = '';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    dom.loginError.textContent = '';
    const submitBtn = $('login-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
        const res = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: $('login-email').value,
                password: $('login-password').value,
            }),
        });
        const data = await res.json();
        if (!res.ok) {
            dom.loginError.textContent = data.error;
            return;
        }
        currentUser = data.user;
        updateAuthUI(true);
        closeAuthModal();
        showToast(`Welcome back, ${data.user.username}!`, 'success');
        await checkAuth(); // refresh counts
    } catch (err) {
        console.error('Login error:', err);
        dom.loginError.textContent = 'Cannot connect to server. Make sure you opened http://localhost:3000';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    dom.registerError.textContent = '';
    const submitBtn = $('register-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    try {
        const res = await fetch(`${API_BASE}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: $('register-username').value,
                email: $('register-email').value,
                password: $('register-password').value,
            }),
        });
        const data = await res.json();
        if (!res.ok) {
            dom.registerError.textContent = data.error;
            return;
        }
        currentUser = data.user;
        updateAuthUI(true);
        closeAuthModal();
        showToast(`Welcome to CineScope, ${data.user.username}!`, 'success');
        await checkAuth();
    } catch (err) {
        console.error('Register error:', err);
        dom.registerError.textContent = 'Cannot connect to server. Make sure you opened http://localhost:3000';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
    }
}

async function handleLogout() {
    try {
        await fetch(`${API_BASE}/api/logout`, { method: 'POST' });
        currentUser = null;
        updateAuthUI(false);
        dom.userDropdown.classList.remove('active');
        showToast('Signed out successfully', 'info');
        // Go back to home if on favorites/watchlist
        hideAllUserSections();
    } catch {
        showToast('Logout failed', 'error');
    }
}

// =========================================
//  FAVORITES & WATCHLIST
// =========================================
async function toggleFavorite(movieId, movieTitle, moviePoster, movieRating) {
    if (!currentUser) {
        openAuthModal('login');
        return;
    }
    try {
        const checkRes = await fetch(`${API_BASE}/api/favorites/check/${movieId}`);
        const checkData = await checkRes.json();

        if (checkData.isFavorite) {
            await fetch(`${API_BASE}/api/favorites/${movieId}`, { method: 'DELETE' });
            showToast('Removed from favorites', 'info');
        } else {
            await fetch(`${API_BASE}/api/favorites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ movie_id: movieId, movie_title: movieTitle, movie_poster: moviePoster, movie_rating: movieRating }),
            });
            showToast('Added to favorites!', 'success');
        }
        await checkAuth();
    } catch {
        showToast('Something went wrong', 'error');
    }
}

async function toggleWatchlist(movieId, movieTitle, moviePoster, movieRating) {
    if (!currentUser) {
        openAuthModal('login');
        return;
    }
    try {
        const checkRes = await fetch(`${API_BASE}/api/watchlist/check/${movieId}`);
        const checkData = await checkRes.json();

        if (checkData.isInWatchlist) {
            await fetch(`${API_BASE}/api/watchlist/${movieId}`, { method: 'DELETE' });
            showToast('Removed from watchlist', 'info');
        } else {
            await fetch(`${API_BASE}/api/watchlist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ movie_id: movieId, movie_title: movieTitle, movie_poster: moviePoster, movie_rating: movieRating }),
            });
            showToast('Added to watchlist!', 'success');
        }
        await checkAuth();
    } catch {
        showToast('Something went wrong', 'error');
    }
}

async function showFavoritesSection() {
    if (!currentUser) { openAuthModal('login'); return; }
    dom.userDropdown.classList.remove('active');

    hideMainSections();
    dom.favoritesSection.classList.remove('hidden');
    dom.favoritesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const res = await fetch(`${API_BASE}/api/favorites`);
    const data = await res.json();
    dom.favoritesGrid.innerHTML = '';

    if (data.favorites.length === 0) {
        dom.favoritesGrid.innerHTML = `<div class="no-results" style="grid-column: 1 / -1;"><h3>No favorites yet</h3><p>Click the ♥ button on any movie to save it here.</p></div>`;
        dom.favoritesSubtitle.textContent = '0 films saved';
    } else {
        dom.favoritesSubtitle.textContent = `${data.favorites.length} film${data.favorites.length > 1 ? 's' : ''} saved`;
        data.favorites.forEach((fav, i) => {
            const card = createSavedMovieCard(fav, i);
            dom.favoritesGrid.appendChild(card);
        });
    }
}

async function showWatchlistSection() {
    if (!currentUser) { openAuthModal('login'); return; }
    dom.userDropdown.classList.remove('active');

    hideMainSections();
    dom.watchlistSection.classList.remove('hidden');
    dom.watchlistSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const res = await fetch(`${API_BASE}/api/watchlist`);
    const data = await res.json();
    dom.watchlistGrid.innerHTML = '';

    if (data.watchlist.length === 0) {
        dom.watchlistGrid.innerHTML = `<div class="no-results" style="grid-column: 1 / -1;"><h3>Watchlist is empty</h3><p>Add movies to your watchlist to track what to watch next.</p></div>`;
        dom.watchlistSubtitle.textContent = '0 films queued';
    } else {
        dom.watchlistSubtitle.textContent = `${data.watchlist.length} film${data.watchlist.length > 1 ? 's' : ''} queued`;
        data.watchlist.forEach((item, i) => {
            const card = createSavedMovieCard(item, i);
            dom.watchlistGrid.appendChild(card);
        });
    }
}

function createSavedMovieCard(saved, index = 0) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.style.animationDelay = `${index * 0.04}s`;

    const posterUrl = saved.movie_poster && saved.movie_poster !== 'N/A' ? saved.movie_poster : PLACEHOLDER_POSTER;
    const rating = (saved.movie_rating || 0).toFixed ? Number(saved.movie_rating || 0).toFixed(1) : '0.0';

    card.innerHTML = `
        <div class="movie-card-poster">
            <img src="${posterUrl}" alt="${saved.movie_title}" loading="lazy">
            <div class="movie-card-rating">${rating}</div>
        </div>
        <div class="movie-card-info">
            <div class="movie-card-title">${saved.movie_title}</div>
        </div>
    `;

    card.addEventListener('click', () => openMovieModal(saved.movie_id));
    return card;
}

function hideMainSections() {
    document.getElementById('spotlight-section').style.display = 'none';
    document.getElementById('trending-section').style.display = 'none';
    document.getElementById('top-rated-section').style.display = 'none';
    document.getElementById('upcoming-section').style.display = 'none';
    dom.searchResultsSection.classList.add('hidden');
    dom.favoritesSection.classList.add('hidden');
    dom.watchlistSection.classList.add('hidden');
}

function hideAllUserSections() {
    dom.favoritesSection.classList.add('hidden');
    dom.watchlistSection.classList.add('hidden');
    document.getElementById('spotlight-section').style.display = '';
    document.getElementById('trending-section').style.display = '';
    document.getElementById('top-rated-section').style.display = '';
    document.getElementById('upcoming-section').style.display = '';
}

// --- OMDB API Helpers ---
async function omdbSearch(query, page = 1) {
    const res = await fetch(`${API_BASE}/api/omdb/search?q=${encodeURIComponent(query)}&page=${page}`);
    if (!res.ok) throw new Error(`OMDB API Error: ${res.status}`);
    return res.json();
}

async function omdbGetMovie(imdbId) {
    const res = await fetch(`${API_BASE}/api/omdb/movie/${imdbId}`);
    if (!res.ok) throw new Error(`OMDB API Error: ${res.status}`);
    return res.json();
}

async function omdbBatchFetch(ids) {
    const res = await fetch(`${API_BASE}/api/omdb/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error(`OMDB Batch Error: ${res.status}`);
    return res.json();
}

// --- Normalize OMDB movie to common format ---
function normalizeOMDBMovie(m) {
    return {
        id: m.imdbID,
        title: m.Title,
        year: m.Year,
        poster: (m.Poster && m.Poster !== 'N/A') ? m.Poster : null,
        rating: parseFloat(m.imdbRating) || 0,
        plot: m.Plot || '',
        genre: m.Genre || '',
        runtime: m.Runtime || '',
        director: m.Director || '',
        actors: m.Actors || '',
        writer: m.Writer || '',
        rated: m.Rated || '',
        released: m.Released || '',
        language: m.Language || '',
        country: m.Country || '',
        awards: m.Awards || '',
        metascore: m.Metascore || '',
        imdbVotes: m.imdbVotes || '',
        boxOffice: m.BoxOffice || '',
        production: m.Production || '',
        ratings: m.Ratings || [],
        type: m.Type || 'movie',
    };
}

function normalizeOMDBSearchResult(m) {
    return {
        id: m.imdbID,
        title: m.Title,
        year: m.Year,
        poster: (m.Poster && m.Poster !== 'N/A') ? m.Poster : null,
        type: m.Type || 'movie',
    };
}

// --- Render ---
function createMovieCard(movie, index = 0) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.style.animationDelay = `${index * 0.04}s`;

    const posterUrl = movie.poster || PLACEHOLDER_POSTER;
    const year = movie.year || '';
    const rating = movie.rating ? movie.rating.toFixed(1) : '';

    card.innerHTML = `
        <div class="movie-card-poster">
            <img src="${posterUrl}" alt="${movie.title}" loading="lazy">
            ${rating ? `<div class="movie-card-rating">${rating}</div>` : ''}
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
    dom.heroGenres.innerHTML = '';
    GENRE_LIST.forEach(genre => {
        const chip = document.createElement('button');
        chip.className = 'genre-chip';
        chip.textContent = genre;
        chip.addEventListener('click', () => searchByGenre(genre));
        dom.heroGenres.appendChild(chip);
    });
}

async function searchByGenre(genreName) {
    searchQuery = genreName;
    searchPage = 1;
    dom.searchInput.value = genreName;
    dom.navSearchInput.value = genreName;
    dom.searchResultsTitle.textContent = `${genreName} Movies`;
    dom.searchResultsSubtitle.textContent = `Browsing ${genreName.toLowerCase()} films`;

    try {
        const data = await omdbSearch(genreName, 1);
        if (data.Response === 'True') {
            totalSearchResults = parseInt(data.totalResults) || 0;
            const movies = data.Search.map(normalizeOMDBSearchResult);
            showSearchResults(movies, totalSearchResults, false);
        } else {
            showSearchResults([], 0, false);
        }
    } catch (err) {
        console.error('Genre search error:', err);
    }
}

// --- Spotlight ---
async function loadSpotlight() {
    try {
        // Pick a random movie from the trending list for spotlight
        const spotlightId = CURATED.trending[Math.floor(Math.random() * 5)]; // pick from top 5
        const movie = await omdbGetMovie(spotlightId);
        if (!movie || movie.Response === 'False') return;

        const normalized = normalizeOMDBMovie(movie);
        currentSpotlightId = normalized.id;

        // Use poster as backdrop since OMDB doesn't have backdrops
        if (normalized.poster) {
            dom.spotlightBackdrop.style.backgroundImage = `url(${normalized.poster})`;
            document.querySelector('.hero-bg').style.backgroundImage = `url(${normalized.poster})`;
        }

        dom.spotlightTitle.textContent = normalized.title;
        dom.spotlightOverview.textContent = normalized.plot;

        const genreList = normalized.genre.split(', ').slice(0, 3).join(', ');
        dom.spotlightMeta.innerHTML = `
            <span class="meta-item"><strong>${normalized.rating.toFixed(1)}</strong> / 10</span>
            <span class="meta-dot"></span>
            <span class="meta-item">${normalized.year}</span>
            <span class="meta-dot"></span>
            <span class="meta-item">${genreList}</span>
        `;

        if (normalized.poster) {
            dom.spotlightPoster.innerHTML = `<img src="${normalized.poster}" alt="${normalized.title}">`;
        }

        dom.spotlightDetailsBtn.onclick = () => openMovieModal(normalized.id);
        dom.spotlightTrailerBtn.onclick = () => searchTrailer(normalized.title, normalized.year);
    } catch (err) {
        console.error('Spotlight error:', err);
    }
}

// --- Load Sections ---
async function loadCuratedSection(containerId, ids) {
    try {
        const data = await omdbBatchFetch(ids);
        const movies = data.results.map(normalizeOMDBMovie);
        renderCarousel(containerId, movies);
    } catch (err) {
        console.error(`Error loading ${containerId}:`, err);
    }
}

async function loadTrending() {
    await loadCuratedSection('trending-movies', CURATED.trending);
}

async function loadTopRated() {
    await loadCuratedSection('toprated-movies', CURATED.topRated);
}

async function loadUpcoming() {
    await loadCuratedSection('upcoming-movies', CURATED.upcoming);
}

// --- Search ---
async function performSearch(query, page = 1) {
    if (!query.trim()) return;
    searchQuery = query;
    searchPage = page;

    try {
        const data = await omdbSearch(query, page);
        dom.searchResultsTitle.textContent = 'Search Results';

        if (data.Response === 'True') {
            totalSearchResults = parseInt(data.totalResults) || 0;
            dom.searchResultsSubtitle.textContent = `${totalSearchResults.toLocaleString()} results for "${query}"`;
            const movies = data.Search.map(normalizeOMDBSearchResult);
            showSearchResults(movies, totalSearchResults, page > 1);
        } else {
            dom.searchResultsSubtitle.textContent = `No results for "${query}"`;
            showSearchResults([], 0, false);
        }
    } catch (err) {
        console.error('Search error:', err);
    }
}

function showSearchResults(results, totalResults, append = false) {
    dom.searchResultsSection.classList.remove('hidden');
    dom.favoritesSection.classList.add('hidden');
    dom.watchlistSection.classList.add('hidden');
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
    dom.favoritesSection.classList.add('hidden');
    dom.watchlistSection.classList.add('hidden');
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
        const data = await omdbSearch(query, 1);
        if (data.Response !== 'True' || !data.Search) {
            dom.searchSuggestions.classList.remove('active');
            return;
        }
        const results = data.Search.slice(0, 6);

        dom.searchSuggestions.innerHTML = results.map(movie => {
            const posterUrl = (movie.Poster && movie.Poster !== 'N/A') ? movie.Poster : PLACEHOLDER_POSTER;
            const year = movie.Year || '';
            return `
                <div class="suggestion-item" data-id="${movie.imdbID}">
                    <img class="suggestion-poster" src="${posterUrl}" alt="${movie.Title}" loading="lazy">
                    <div class="suggestion-info">
                        <div class="suggestion-title">${movie.Title}</div>
                        <div class="suggestion-year">${year}</div>
                    </div>
                </div>
            `;
        }).join('');

        dom.searchSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                openMovieModal(item.dataset.id);
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
        const movie = await omdbGetMovie(movieId);
        if (!movie || movie.Response === 'False') {
            showToast('Could not load movie details', 'error');
            closeMovieModal();
            return;
        }

        const m = normalizeOMDBMovie(movie);

        // Check favorite/watchlist status
        let isFavorite = false;
        let isInWatchlist = false;
        if (currentUser) {
            try {
                const [favRes, watchRes] = await Promise.all([
                    fetch(`${API_BASE}/api/favorites/check/${movieId}`),
                    fetch(`${API_BASE}/api/watchlist/check/${movieId}`),
                ]);
                const favData = await favRes.json();
                const watchData = await watchRes.json();
                isFavorite = favData.isFavorite;
                isInWatchlist = watchData.isInWatchlist;
            } catch { /* ignore */ }
        }

        // Backdrop — use poster since OMDB has no backdrops
        if (m.poster) {
            dom.modalBackdrop.style.backgroundImage = `url(${m.poster})`;
        } else {
            dom.modalBackdrop.style.backgroundImage = 'none';
            dom.modalBackdrop.style.background = 'var(--bg-card)';
        }

        // Poster
        dom.modalPoster.src = m.poster || PLACEHOLDER_POSTER;
        dom.modalPoster.alt = m.title;

        // Rating
        dom.modalRating.textContent = m.rating.toFixed(1);

        // Title & Tagline
        dom.modalTitle.textContent = m.title;
        // OMDB doesn't have taglines, show awards instead if present
        if (m.awards && m.awards !== 'N/A') {
            dom.modalTagline.textContent = m.awards;
            dom.modalTagline.style.display = 'block';
        } else {
            dom.modalTagline.textContent = '';
            dom.modalTagline.style.display = 'none';
        }

        // Meta
        const metaParts = [m.year, m.runtime !== 'N/A' ? m.runtime : '', m.rated !== 'N/A' ? m.rated : ''].filter(Boolean);
        dom.modalMeta.innerHTML = metaParts.map((p, i) => `
            ${i > 0 ? '<span class="meta-dot"></span>' : ''}
            <span class="meta-item">${p}</span>
        `).join('');

        // Genres
        const genres = m.genre.split(', ').filter(g => g && g !== 'N/A');
        dom.modalGenres.innerHTML = genres.map(g =>
            `<span class="modal-genre-tag">${g}</span>`
        ).join('');

        // Overview
        dom.modalOverview.textContent = (m.plot && m.plot !== 'N/A') ? m.plot : 'No overview available.';

        // Movie action buttons (favorite + watchlist)
        let actionsContainer = dom.movieModal.querySelector('.modal-actions');
        if (!actionsContainer) {
            actionsContainer = document.createElement('div');
            actionsContainer.className = 'modal-actions';
            dom.modalGenres.after(actionsContainer);
        }
        actionsContainer.innerHTML = `
            <button class="modal-action-btn ${isFavorite ? 'active' : ''}" id="modal-fav-btn">
                <svg viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                ${isFavorite ? 'Favorited' : 'Favorite'}
            </button>
            <button class="modal-action-btn ${isInWatchlist ? 'active' : ''}" id="modal-watch-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                ${isInWatchlist ? 'In Watchlist' : 'Watchlist'}
            </button>
        `;

        $('modal-fav-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            await toggleFavorite(m.id, m.title, m.poster, m.rating);
            const btn = $('modal-fav-btn');
            const nowFav = btn.classList.toggle('active');
            btn.querySelector('svg').setAttribute('fill', nowFav ? 'currentColor' : 'none');
            btn.childNodes[btn.childNodes.length - 1].textContent = nowFav ? 'Favorited' : 'Favorite';
        });

        $('modal-watch-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            await toggleWatchlist(m.id, m.title, m.poster, m.rating);
            const btn = $('modal-watch-btn');
            const nowWatch = btn.classList.toggle('active');
            btn.childNodes[btn.childNodes.length - 1].textContent = nowWatch ? 'In Watchlist' : 'Watchlist';
        });

        // Details Grid
        const details = [];
        if (m.director && m.director !== 'N/A') details.push({ label: 'Director', value: m.director });
        if (m.writer && m.writer !== 'N/A') details.push({ label: 'Writer', value: m.writer.split(',').slice(0, 2).join(', ') });
        if (m.language && m.language !== 'N/A') details.push({ label: 'Language', value: m.language });
        if (m.country && m.country !== 'N/A') details.push({ label: 'Country', value: m.country });
        if (m.boxOffice && m.boxOffice !== 'N/A') details.push({ label: 'Box Office', value: m.boxOffice });
        if (m.metascore && m.metascore !== 'N/A') details.push({ label: 'Metascore', value: m.metascore + '/100' });
        if (m.imdbVotes && m.imdbVotes !== 'N/A') details.push({ label: 'IMDb Votes', value: m.imdbVotes });

        // Add external ratings
        if (m.ratings && m.ratings.length > 0) {
            m.ratings.forEach(r => {
                if (r.Source === 'Rotten Tomatoes') {
                    details.push({ label: 'Rotten Tomatoes', value: r.Value });
                }
            });
        }

        dom.modalDetailsGrid.innerHTML = details.map(d => `
            <div class="detail-item">
                <div class="detail-label">${d.label}</div>
                <div class="detail-value">${d.value}</div>
            </div>
        `).join('');

        // Cast — OMDB gives actors as a comma-separated string
        const actors = m.actors.split(', ').filter(a => a && a !== 'N/A');
        if (actors.length) {
            dom.modalCastSection.style.display = 'block';
            dom.modalCast.innerHTML = actors.map(name => `
                <div class="cast-item">
                    <img class="cast-avatar" src="${PLACEHOLDER_PROFILE}" alt="${name}" loading="lazy">
                    <div class="cast-name">${name}</div>
                    <div class="cast-character"></div>
                </div>
            `).join('');
        } else {
            dom.modalCastSection.style.display = 'none';
        }

        // Similar movies — OMDB doesn't have this, so hide
        dom.modalSimilarSection.style.display = 'none';

        // Store movie info for trailer search
        dom.movieModal.dataset.movieTitle = m.title;
        dom.movieModal.dataset.movieYear = m.year;

    } catch (err) {
        console.error('Modal error:', err);
        closeMovieModal();
    }
}

function closeMovieModal() {
    dom.modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

// --- Trailer (search YouTube) ---
function searchTrailer(title, year) {
    const query = encodeURIComponent(`${title} ${year} official trailer`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
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
        await performSearch(searchQuery, searchPage);
    });

    // Trending tabs — with OMDB we use the same curated list
    $('trending-day-tab').addEventListener('click', function () {
        this.classList.add('active');
        $('trending-week-tab').classList.remove('active');
        loadTrending();
    });
    $('trending-week-tab').addEventListener('click', function () {
        this.classList.add('active');
        $('trending-day-tab').classList.remove('active');
        loadTrending();
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
        if (currentSpotlightId) {
            const title = dom.movieModal.dataset.movieTitle || dom.spotlightTitle.textContent;
            const year = dom.movieModal.dataset.movieYear || '';
            searchTrailer(title, year);
        }
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (dom.trailerOverlay.classList.contains('active')) closeTrailer();
            else if (dom.authOverlay.classList.contains('active')) closeAuthModal();
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

    // ===== AUTH EVENT LISTENERS =====

    // Open auth modal
    dom.navLoginBtn.addEventListener('click', () => openAuthModal('login'));

    // Close auth modal
    dom.authClose.addEventListener('click', closeAuthModal);
    dom.authOverlay.addEventListener('click', (e) => {
        if (e.target === dom.authOverlay) closeAuthModal();
    });

    // Auth tabs
    dom.authTabLogin.addEventListener('click', () => switchAuthTab('login'));
    dom.authTabRegister.addEventListener('click', () => switchAuthTab('register'));

    // Login form
    dom.loginForm.addEventListener('submit', handleLogin);

    // Register form
    dom.registerForm.addEventListener('submit', handleRegister);

    // User avatar dropdown
    dom.userAvatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.userDropdown.classList.toggle('active');
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-user')) {
            dom.userDropdown.classList.remove('active');
        }
    });

    // Dropdown actions
    dom.dropdownFavorites.addEventListener('click', showFavoritesSection);
    dom.dropdownWatchlist.addEventListener('click', showWatchlistSection);
    dom.dropdownLogout.addEventListener('click', handleLogout);

    // Favorites / Watchlist back buttons
    dom.closeFavoritesBtn.addEventListener('click', hideAllUserSections);
    dom.closeWatchlistBtn.addEventListener('click', hideAllUserSections);
}

// --- Carousels ---
function setupCarousels() {
    setupCarousel('trending-movies', 'trending-prev', 'trending-next');
    setupCarousel('toprated-movies', 'toprated-prev', 'toprated-next');
    setupCarousel('upcoming-movies', 'upcoming-prev', 'upcoming-next');
}

// --- Init ---
async function initApp() {
    try {
        // Auth check — non-blocking, don't let it break the app
        try { await checkAuth(); } catch (e) { console.warn('Auth check skipped:', e); }

        renderGenreChips();
        setupEventListeners();
        setupCarousels();

        await Promise.all([
            loadSpotlight(),
            loadTrending(),
            loadTopRated(),
            loadUpcoming(),
        ]);
    } catch (err) {
        console.error('Init error:', err);
    }

    // Always remove loading overlay
    setTimeout(() => {
        dom.loadingOverlay.classList.add('fade-out');
    }, 300);
}

// --- Start ---
document.addEventListener('DOMContentLoaded', initApp);
