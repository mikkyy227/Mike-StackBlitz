(() => {
  if (typeof document === 'undefined') return;

  const views = [...document.querySelectorAll('.view')];
  let toastTimer;
  let authMode = 'login';
  let currentUser = null;
  const accounts = new Map();
  const savedData = readStore('hustlehub-saved', []);
  const saved = new Set(Array.isArray(savedData) ? savedData : []);
  const listingData = readStore('hustlehub-listings', []);
  let listings = Array.isArray(listingData) ? listingData : [];

  function readStore(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      showToast('Browser storage is unavailable. Changes may not persist.');
    }
  }

  function on(element, eventName, handler) {
    if (element) element.addEventListener(eventName, handler);
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function navigate(viewName) {
    const target = document.getElementById(`view-${viewName}`);
    if (!target) return;
    views.forEach(view => {
      const active = view === target;
      view.hidden = !active;
      view.classList.toggle('active', active);
    });
    document.querySelectorAll('[data-view]').forEach(button => {
      const active = button.dataset.view === viewName;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if (window.location.hash !== `#${viewName}`) history.replaceState(null, '', `#${viewName}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function listingCard(listing) {
    const isSaved = saved.has(listing.id);
    return `<article class="opportunity-card">
      <div class="opportunity-top"><span class="listing-category">${escapeHtml(listing.category)}</span><button class="save-button ${isSaved ? 'is-saved' : ''}" type="button" data-save="${escapeHtml(listing.id)}" aria-label="${isSaved ? 'Remove saved listing' : 'Save listing'}">${isSaved ? '♥' : '♡'}</button></div>
      <h3>${escapeHtml(listing.title)}</h3><p class="listing-organization">${escapeHtml(listing.organization)}</p>
      <p class="listing-meta">${escapeHtml(listing.state)} <span>·</span> ${escapeHtml(listing.work)} <span>·</span> ${escapeHtml(listing.pay)}</p>
      <p class="listing-description-text">${escapeHtml(listing.description)}</p>
      <small class="listing-date">Demo listing · ${escapeHtml(listing.date)}</small>
    </article>`;
  }

  function fieldValue(id) {
    const field = document.getElementById(id);
    return field ? field.value : '';
  }

  function renderListings() {
    const query = fieldValue('explore-search').trim().toLowerCase();
    const category = fieldValue('category-filter');
    const state = fieldValue('state-filter');
    const work = fieldValue('work-filter');
    const pay = fieldValue('pay-filter');
    const results = listings.filter(listing => {
      const text = `${listing.title} ${listing.organization} ${listing.category} ${listing.description}`.toLowerCase();
      return (!query || text.includes(query)) && (!category || listing.category === category) &&
        (!state || listing.state === state) && (!work || listing.work === work) && (!pay || listing.pay === pay);
    });
    const resultNode = document.getElementById('explore-results');
    const emptyNode = document.getElementById('explore-empty');
    const countNode = document.getElementById('results-count');
    if (resultNode) resultNode.innerHTML = results.map(listingCard).join('');
    if (emptyNode) emptyNode.hidden = results.length > 0;
    if (countNode) countNode.textContent = `${results.length} ${results.length === 1 ? 'result' : 'results'}`;

    const homeListings = document.getElementById('home-listings');
    const homeEmpty = document.getElementById('home-empty');
    const latest = [...listings].slice(-3).reverse();
    if (homeListings) homeListings.innerHTML = latest.map(listingCard).join('');
    if (homeEmpty) homeEmpty.hidden = latest.length > 0;

    const savedListings = document.getElementById('saved-listings');
    const savedEmpty = document.getElementById('saved-empty');
    const savedItems = listings.filter(listing => saved.has(listing.id));
    if (savedListings) savedListings.innerHTML = savedItems.map(listingCard).join('');
    if (savedEmpty) savedEmpty.hidden = savedItems.length > 0;
  }

  function updateAccountUI() {
    const authPanel = document.getElementById('auth-panel');
    const accountPanel = document.getElementById('account-panel');
    const listingForm = document.getElementById('listing-form');
    const signinNote = document.getElementById('submit-signin-note');
    if (authPanel) authPanel.hidden = Boolean(currentUser);
    if (accountPanel) accountPanel.hidden = !currentUser;
    if (listingForm) listingForm.hidden = !currentUser;
    if (signinNote) signinNote.hidden = Boolean(currentUser);
    const greeting = document.getElementById('account-greeting');
    if (greeting && currentUser) greeting.textContent = `Hi, ${currentUser.name}`;
    document.querySelectorAll('.header-signin').forEach(button => {
      button.textContent = currentUser ? 'Account' : 'Sign in';
    });
  }

  document.querySelectorAll('[data-view]').forEach(button => {
    on(button, 'click', event => {
      event.preventDefault();
      navigate(button.dataset.view);
    });
  });

  document.querySelectorAll('.category-card').forEach(button => {
    on(button, 'click', () => {
      navigate('explore');
      const filter = document.getElementById('category-filter');
      if (filter) filter.value = button.dataset.category;
      renderListings();
      const exploreSearch = document.getElementById('explore-search');
      if (exploreSearch) exploreSearch.focus();
    });
  });

  on(document.querySelector('.home-search'), 'submit', event => {
    event.preventDefault();
    const homeSearch = document.getElementById('home-search');
    const query = homeSearch ? homeSearch.value.trim() : '';
    const exploreSearch = document.getElementById('explore-search');
    if (exploreSearch) exploreSearch.value = query;
    navigate('explore');
    renderListings();
  });

  on(document.getElementById('explore-form'), 'submit', event => {
    event.preventDefault();
    renderListings();
  });

  ['explore-search', 'category-filter', 'state-filter', 'work-filter', 'pay-filter'].forEach(id => {
    on(document.getElementById(id), 'input', renderListings);
    on(document.getElementById(id), 'change', renderListings);
  });

  document.querySelectorAll('[data-auth-mode]').forEach(button => {
    on(button, 'click', () => {
      authMode = button.dataset.authMode;
      document.querySelectorAll('[data-auth-mode]').forEach(tab => tab.classList.toggle('active', tab === button));
      const nameField = document.getElementById('name-field');
      const nameInput = nameField ? nameField.querySelector('input') : null;
      const passwordInput = document.querySelector('#auth-form [name="password"]');
      const submitButton = document.getElementById('auth-submit');
      if (nameField) nameField.hidden = authMode !== 'register';
      if (nameInput) nameInput.required = authMode === 'register';
      if (passwordInput) passwordInput.autocomplete = authMode === 'register' ? 'new-password' : 'current-password';
      if (submitButton) submitButton.textContent = authMode === 'register' ? 'Create account' : 'Sign in';
    });
  });

  on(document.getElementById('auth-form'), 'submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email')).trim().toLowerCase();
    const password = String(data.get('password'));
    if (authMode === 'register') {
      const name = String(data.get('name')).trim();
      if (!name) return showToast('Enter your name to create an account.');
      if (accounts.has(email)) return showToast('That demo account already exists. Sign in instead.');
      accounts.set(email, { name, password });
      currentUser = { name, email };
      showToast('Demo account created. You’re signed in!');
    } else {
      const account = accounts.get(email);
      if (!account || account.password !== password) return showToast('Demo account not found. Create one first in this session.');
      currentUser = { name: account.name, email };
      showToast('You’re signed in to the demo.');
    }
    form.reset();
    updateAccountUI();
  });

  on(document.getElementById('signout-button'), 'click', () => {
    currentUser = null;
    updateAccountUI();
    showToast('You’re signed out.');
  });

  on(document.getElementById('listing-form'), 'submit', event => {
    event.preventDefault();
    if (!currentUser) return showToast('Sign in to publish a demo listing.');
    const data = new FormData(event.currentTarget);
    const listing = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: String(data.get('title')).trim(),
      organization: String(data.get('organization')).trim(),
      category: String(data.get('category')),
      state: String(data.get('state')),
      work: String(data.get('work')),
      pay: String(data.get('pay')),
      description: String(data.get('description')).trim(),
      date: new Date().toLocaleDateString()
    };
    listings = [...listings, listing];
    writeStore('hustlehub-listings', listings);
    event.currentTarget.reset();
    renderListings();
    navigate('explore');
    showToast('Demo listing published in this browser.');
  });

  document.addEventListener('click', event => {
    const saveButton = event.target.closest('[data-save]');
    if (!saveButton) return;
    if (!currentUser) {
      showToast('Create a demo account or sign in to save listings.');
      navigate('profile');
      return;
    }
    const id = saveButton.dataset.save;
    if (saved.has(id)) saved.delete(id);
    else saved.add(id);
    writeStore('hustlehub-saved', [...saved]);
    renderListings();
  });

  document.querySelectorAll('[data-info]').forEach(link => {
    on(link, 'click', event => {
      event.preventDefault();
      showToast(`${link.dataset.info} information will be available before launch.`);
    });
  });

  renderListings();
  updateAccountUI();
  const requestedView = window.location.hash.slice(1);
  if (requestedView && document.getElementById(`view-${requestedView}`)) navigate(requestedView);
})();
