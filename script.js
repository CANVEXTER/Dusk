(function() {
  function hexToRgb(hex) {
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
  }

  // Renamed Database to Dusk_DB
  const dbPromise = new Promise((resolve, reject) => {
    const req = window.indexedDB.open('Dusk_DB', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('store');
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e);
  });

  async function saveImgToDB(data) {
    try {
      const db = await dbPromise;
      const tx = db.transaction('store', 'readwrite');
      tx.objectStore('store').put(data, 'uploadBg');
    } catch(e) { console.error("Failed to save image to DB", e); }
  }

  async function loadImgFromDB() {
    try {
      const db = await dbPromise;
      return new Promise(res => {
        const tx = db.transaction('store', 'readonly');
        const req = tx.objectStore('store').get('uploadBg');
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(null);
      });
    } catch(e) { return null; }
  }

  let searchEngines = [
    { id: 'duckduckgo', name: 'DuckDuckGo', query: 'https://duckduckgo.com/?q=', standard: true },
    { id: 'google', name: 'Google', query: 'https://www.google.com/search?q=', standard: true }
  ];

  let bookmarks = [
    { id: 1, name: 'Google', url: 'https://google.com', fav: true },
    { id: 2, name: 'GitHub', url: 'https://github.com', fav: true },
    { id: 3, name: 'MDN', url: 'https://developer.mozilla.org', fav: true },
    { id: 4, name: 'Reddit', url: 'https://reddit.com', fav: false },
    { id: 5, name: 'Figma', url: 'https://figma.com', fav: true },
  ];

  let settings = {
    background: 'linear-gradient(145deg, #1a2f3f 0%, #1e4b5e 100%)', bgType: 'image', customColor: '#1a2f3f', imageUrl: 'default.png',
    panelCurvature: 32, panelScale: '1', iconScale: '1', syncScale: true,
    autoTheme: true, manualAccentColor: '#5c85d6', acrylicBlur: '16',
    searchEngineId: 'duckduckgo', searchSuggestions: true,
    clock: { enabled: true, size: '1', format: '12h', colorMode: 'auto', manualColor: '#eef2f5' },
    panelColorMode: 'auto', panelManualColor: '#14191e', panelOpacity: 0.4, panelBrightness: 1.0
  };

  let libState = { view: 'grid', search: '' };
  let clockInterval = null;
  let isEditMode = false;
  
  const fallbackIcon = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%238aa0b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'></circle><line x1='2' y1='12' x2='22' y2='12'></line><path d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'></path></svg>";

  function escapeHTML(str) { const p = document.createElement('p'); p.textContent = str; return p.innerHTML; }

  function getFaviconUrl(url) {
    let hostname;
    try { hostname = new URL(url).hostname; } catch (e) { hostname = url.replace(/^https?:\/\//, '').replace(/\/.*$/, ''); }
    return `https://icon.horse/icon/${hostname}`;
  }

  function loadData() {
    try {
      // Renamed localStorage keys to match Dusk
      const storedB = localStorage.getItem('dusk_bookmarks'); if (storedB) bookmarks = JSON.parse(storedB);
      const storedE = localStorage.getItem('dusk_engines'); if (storedE) searchEngines = searchEngines.concat(JSON.parse(storedE));
      const storedS = localStorage.getItem('dusk_settings'); 
      if (storedS) { 
        settings = { ...settings, ...JSON.parse(storedS) }; 
        if (settings.uploadData) { saveImgToDB(settings.uploadData); saveSettings(); }
      }
      const storedView = localStorage.getItem('dusk_lib_view');
      if (storedView) libState.view = storedView;
    } catch (e) {}
  }

  function saveBookmarks() { localStorage.setItem('dusk_bookmarks', JSON.stringify(bookmarks)); }
  function saveEngines() { localStorage.setItem('dusk_engines', JSON.stringify(searchEngines.filter(e => !e.standard))); }
  function saveSettings() {
    try { 
      const toSave = { ...settings };
      delete toSave.uploadData; 
      localStorage.setItem('dusk_settings', JSON.stringify(toSave)); 
    } catch (e) { console.error('Failed to save settings.'); }
  }

  function renderFavorites() {
    const grid = document.getElementById('favoritesGrid');
    grid.innerHTML = bookmarks.filter(b => b.fav).map(b => `
      <div class="bookmark-item">
        <a href="${escapeHTML(b.url)}" target="_blank" class="bookmark-link">
          <img class="bookmark-icon" src="${escapeHTML(getFaviconUrl(b.url))}" onerror="this.src='${fallbackIcon}'" loading="lazy">
          <span class="bookmark-title">${escapeHTML(b.name)}</span>
        </a>
      </div>
    `).join('');
  }

  function renderAppLibrary() {
    const container = document.getElementById('allBookmarksContainer');
    let filtered = bookmarks.filter(b => b.name.toLowerCase().includes(libState.search.toLowerCase()));
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    
    let baseClass = 'all-bookmarks-container';
    if (isEditMode) baseClass += ' edit-mode';

    if (libState.view === 'grid') {
      container.className = `${baseClass} lib-grid`;
      container.innerHTML = filtered.map(b => `
        <div class="bookmark-item">
          <a href="${escapeHTML(b.url)}" target="_blank" class="bookmark-link">
            <img class="bookmark-icon" src="${escapeHTML(getFaviconUrl(b.url))}" onerror="this.src='${fallbackIcon}'" loading="lazy">
            <span class="bookmark-title">${escapeHTML(b.name)}</span>
          </a>
          <div class="inline-actions">
            <button class="inline-action-btn fav ${b.fav ? 'active' : ''}" data-id="${b.id}" title="Toggle Favorite"><i class="fas fa-star"></i></button>
            <button class="inline-action-btn delete" data-id="${b.id}" title="Delete"><i class="fas fa-trash-alt"></i></button>
          </div>
        </div>
      `).join('');
    } else {
      container.className = `${baseClass} lib-list`;
      const alpha = {};
      filtered.forEach(b => { const l = b.name.charAt(0).toUpperCase(); if(!alpha[l]) alpha[l]=[]; alpha[l].push(b); });
      let html = '';
      Object.keys(alpha).sort().forEach(letter => {
        html += `<div class="alpha-header">${letter}</div>`;
        alpha[letter].forEach(b => {
          html += `
            <div class="lib-list-item-wrapper">
              <a href="${escapeHTML(b.url)}" target="_blank" class="lib-list-item">
                <img src="${escapeHTML(getFaviconUrl(b.url))}" onerror="this.src='${fallbackIcon}'" loading="lazy"><span class="title">${escapeHTML(b.name)}</span>
              </a>
              <div class="inline-actions">
                <button class="inline-action-btn fav ${b.fav ? 'active' : ''}" data-id="${b.id}" title="Toggle Favorite"><i class="fas fa-star"></i></button>
                <button class="inline-action-btn delete" data-id="${b.id}" title="Delete"><i class="fas fa-trash-alt"></i></button>
              </div>
            </div>`;
        });
      });
      container.innerHTML = html;
    }
  }

  function startClock() {
    stopClock();
    if (!settings.clock.enabled) return; 
    document.getElementById('clockPanel').style.display = 'block';
    
    function update() {
      const now = new Date();
      let h = now.getHours(), m = now.getMinutes(), ampm = '';
      if (settings.clock.format === '12h') { ampm = h >= 12 ? ' PM' : ' AM'; h = h % 12; h = h ? h : 12; }
      else { h = h < 10 ? '0'+h : h; }
      m = m < 10 ? '0'+m : m;
      document.getElementById('timeDisplay').textContent = `${h}:${m}${ampm}`;
      const d = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      document.getElementById('dateDisplay').textContent = `${d[now.getDay()]}, ${mo[now.getMonth()]} ${now.getDate()}`;
    }
    update(); clockInterval = setInterval(update, 1000);
  }
  
  function stopClock() { 
    if(clockInterval) clearInterval(clockInterval); 
    document.getElementById('clockPanel').style.display = 'none';
  }

  function applyClockAesthetics() {
    document.documentElement.style.setProperty('--clock-scale', settings.clock.size);
    document.getElementById('timeDisplay').style.color = settings.clock.colorMode === 'manual' ? settings.clock.manualColor : 'var(--accent-color)';
  }

  function renderSearchEngines() {
    const list = document.getElementById('engineOptionsList');
    list.innerHTML = searchEngines.map(e => `
      <div class="engine-option ${settings.searchEngineId === e.id ? 'selected' : ''}" data-id="${e.id}">
        <span>${e.name}</span>
        ${!e.standard ? `<button class="delete-engine-btn" data-id="${e.id}"><i class="fas fa-trash"></i></button>` : ''}
      </div>
    `).join('');

    const curr = searchEngines.find(e => e.id === settings.searchEngineId) || searchEngines[0];
    document.getElementById('currentEngineName').innerText = curr.name;

    list.querySelectorAll('.engine-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        if(e.target.closest('.delete-engine-btn')) return;
        settings.searchEngineId = opt.dataset.id; 
        saveSettings(); 
        renderSearchEngines();
        document.getElementById('searchDropdown').classList.remove('active');
      });
    });

    list.querySelectorAll('.delete-engine-btn').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if(settings.searchEngineId === btn.dataset.id) settings.searchEngineId = 'duckduckgo';
      searchEngines = searchEngines.filter(x => x.id !== btn.dataset.id);
      saveEngines(); saveSettings(); renderSearchEngines();
    }));
  }

  window.handleSearchSuggestions = function(data) {
    const suggestions = data[1];
    const container = document.getElementById('searchSuggestions');
    if (!suggestions || suggestions.length === 0) {
      container.classList.remove('active'); return;
    }
    
    container.innerHTML = suggestions.slice(0, 6).map(s => `
      <div class="suggestion-item" data-val="${escapeHTML(s)}">
        <i class="fas fa-search"></i>
        <span>${escapeHTML(s)}</span>
      </div>
    `).join('');
    
    container.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        document.getElementById('search-input').value = item.dataset.val;
        container.classList.remove('active');
        document.getElementById('search-form').dispatchEvent(new Event('submit'));
      });
    });
    container.classList.add('active');
  };

  function extractAccentColor(imgSrc) {
    if (!settings.autoTheme) {
      document.documentElement.style.setProperty('--accent-color', settings.manualAccentColor);
      return;
    }
    const img = new Image(); img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.getElementById('colorCanvas'); const ctx = canvas.getContext('2d');
      canvas.width = 25; canvas.height = 25;
      try {
        ctx.drawImage(img, 0, 0, 25, 25);
        const data = ctx.getImageData(0, 0, 25, 25).data;
        let r=0, g=0, b=0, c=0;
        for(let i=0; i<data.length; i+=16) { r+=data[i]; g+=data[i+1]; b+=data[i+2]; c++; }
        r = Math.min(255, Math.floor(r/c) + 40); g = Math.min(255, Math.floor(g/c) + 40); b = Math.min(255, Math.floor(b/c) + 40);
        document.documentElement.style.setProperty('--accent-color', `rgb(${r},${g},${b})`);
      } catch(e) { document.documentElement.style.setProperty('--accent-color', settings.manualAccentColor); }
    };
    img.onerror = () => document.documentElement.style.setProperty('--accent-color', settings.manualAccentColor);
    img.src = imgSrc;
  }

  function applyThemeAndBackground() {
    let bg = settings.background, colorSrc = null;
    if (settings.bgType === 'image' && settings.imageUrl) { bg = `url('${settings.imageUrl}') center/cover fixed`; colorSrc = settings.imageUrl; }
    else if (settings.bgType === 'upload' && settings.uploadData) { bg = `url('${settings.uploadData}') center/cover fixed`; colorSrc = settings.uploadData; }
    else if (settings.bgType === 'color') { bg = settings.customColor; if(settings.autoTheme) document.documentElement.style.setProperty('--accent-color', bg); }
    else { bg = settings.background; if(settings.autoTheme) document.documentElement.style.setProperty('--accent-color', '#5c85d6'); }

    document.body.style.background = bg;
    if (colorSrc && settings.autoTheme) extractAccentColor(colorSrc);
    else if (!settings.autoTheme) document.documentElement.style.setProperty('--accent-color', settings.manualAccentColor);

    let panelRgb = settings.panelColorMode === 'auto' ? '20, 25, 30' : hexToRgb(settings.panelManualColor);
    document.documentElement.style.setProperty('--panel-bg-rgb', panelRgb);
    document.documentElement.style.setProperty('--panel-bg-opacity', settings.panelOpacity);
    document.documentElement.style.setProperty('--panel-brightness', settings.panelBrightness);

    let curveVal = parseInt(settings.panelCurvature);
    if (isNaN(curveVal)) curveVal = 32;
    document.documentElement.style.setProperty('--border-radius-panel', curveVal + 'px');
    document.documentElement.style.setProperty('--panel-scale', settings.panelScale);
    document.documentElement.style.setProperty('--icon-scale', settings.iconScale);
    document.documentElement.style.setProperty('--acrylic-blur', settings.acrylicBlur + 'px');
    
    if(settings.clock.enabled) { startClock(); applyClockAesthetics(); } else stopClock();
  }

  function setupUIEvents() {
    const leftSide = document.getElementById('bookmarksSidebar');
    const rightSide = document.getElementById('settingsSidebar');
    const overlay = document.getElementById('overlay');
    const leftCornerBtn = document.getElementById('openBookmarksBtn');
    const rightCornerBtn = document.getElementById('openSettingsBtn');

    const closeAll = () => { 
      leftSide.classList.remove('open'); rightSide.classList.remove('open'); 
      overlay.classList.remove('active'); leftCornerBtn.classList.remove('hidden'); rightCornerBtn.classList.remove('hidden');
      if(isEditMode) { isEditMode = false; document.getElementById('editModeToggle').classList.remove('active'); renderAppLibrary(); }
    };

    document.getElementById('openBookmarksBtn').addEventListener('click', () => { 
      closeAll(); leftSide.classList.add('open'); overlay.classList.add('active'); leftCornerBtn.classList.add('hidden'); 
      if (libState.view === 'grid') { document.getElementById('btnViewGridMinimal').classList.add('active'); document.getElementById('btnViewListMinimal').classList.remove('active'); } 
      else { document.getElementById('btnViewListMinimal').classList.add('active'); document.getElementById('btnViewGridMinimal').classList.remove('active'); }
      renderAppLibrary(); 
    });

    document.getElementById('openSettingsBtn').addEventListener('click', () => { 
      closeAll(); rightSide.classList.add('open'); overlay.classList.add('active'); rightCornerBtn.classList.add('hidden'); syncSettingsToUI(); 
    });

    document.getElementById('closeBookmarksBtn').addEventListener('click', closeAll);
    document.getElementById('closeSettingsBtn').addEventListener('click', closeAll);
    overlay.addEventListener('click', closeAll);
    document.getElementById('librarySearch').addEventListener('input', (e) => { libState.search = e.target.value; renderAppLibrary(); });
    
    document.getElementById('btnViewGridMinimal').addEventListener('click', () => { 
      libState.view = 'grid'; localStorage.setItem('dusk_lib_view', 'grid');
      document.getElementById('btnViewGridMinimal').classList.add('active'); document.getElementById('btnViewListMinimal').classList.remove('active'); 
      renderAppLibrary(); 
    });
    
    document.getElementById('btnViewListMinimal').addEventListener('click', () => { 
      libState.view = 'list'; localStorage.setItem('dusk_lib_view', 'list');
      document.getElementById('btnViewListMinimal').classList.add('active'); document.getElementById('btnViewGridMinimal').classList.remove('active'); 
      renderAppLibrary(); 
    });

    document.getElementById('editModeToggle').addEventListener('click', (e) => {
      isEditMode = !isEditMode; e.currentTarget.classList.toggle('active', isEditMode); renderAppLibrary();
    });

    document.getElementById('allBookmarksContainer').addEventListener('click', (e) => {
      const btn = e.target.closest('.inline-action-btn');
      if (!btn) return;
      e.preventDefault(); e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      
      if (btn.classList.contains('fav')) {
        const b = bookmarks.find(x => x.id === id); if(b) b.fav = !b.fav;
      } else if (btn.classList.contains('delete')) {
        bookmarks = bookmarks.filter(x => x.id !== id);
      }
      saveBookmarks(); renderFavorites(); renderAppLibrary();
    });

    const toggleAddBtn = document.getElementById('toggleAddPanelBtn');
    const addPanelCollapsible = document.getElementById('addPanelCollapsible');
    if (toggleAddBtn && addPanelCollapsible) {
      toggleAddBtn.addEventListener('click', () => {
        const isHidden = addPanelCollapsible.style.display === 'none' || getComputedStyle(addPanelCollapsible).display === 'none';
        addPanelCollapsible.style.display = isHidden ? 'block' : 'none';
        const icon = toggleAddBtn.querySelector('i');
        if (isHidden) { icon.classList.replace('fa-plus', 'fa-minus'); toggleAddBtn.classList.add('active'); } 
        else { icon.classList.replace('fa-minus', 'fa-plus'); toggleAddBtn.classList.remove('active'); }
      });
    }

    document.getElementById('addBookmarkBtn').addEventListener('click', () => {
      const name = document.getElementById('newBookmarkName').value.trim(); let url = document.getElementById('newBookmarkUrl').value.trim();
      if (!name || !url) return; if (!url.startsWith('http')) url = 'https://' + url;
      bookmarks.push({ id: Date.now(), name, url, fav: false }); saveBookmarks(); renderAppLibrary(); renderFavorites();
      document.getElementById('newBookmarkName').value = ''; document.getElementById('newBookmarkUrl').value = '';
    });

    document.getElementById('searchEngineToggle').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('searchDropdown').classList.toggle('active'); });
    document.addEventListener('click', (e) => {
      if(!e.target.closest('.search-container')) { document.getElementById('searchSuggestions').classList.remove('active'); document.getElementById('searchDropdown').classList.remove('active'); }
    });

    let suggestionTimeout;
    document.getElementById('search-input').addEventListener('input', (e) => {
      const val = e.target.value.trim();
      const container = document.getElementById('searchSuggestions');
      
      if (settings.searchSuggestions === false || !val) { container.classList.remove('active'); return; }

      clearTimeout(suggestionTimeout);
      const existingScript = document.getElementById('jsonp-suggestion-script');
      if (existingScript) existingScript.remove();

      suggestionTimeout = setTimeout(() => {
        const script = document.createElement('script');
        script.id = 'jsonp-suggestion-script';
        script.src = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(val)}&callback=handleSearchSuggestions`;
        script.onload = () => script.remove();
        script.onerror = () => script.remove();
        document.body.appendChild(script);
      }, 150);
    });

    document.getElementById('addEngineBtn').addEventListener('click', () => {
      const name = document.getElementById('newEngineName').value.trim(); let query = document.getElementById('newEngineQuery').value.trim();
      if (!name || !query) return alert('Fill fields');
      if (!query.startsWith('http')) query = 'https://' + query;
      if (!query.endsWith('=') && !query.includes('%s')) query += '%s';
      searchEngines.push({ id: 'custom_'+Date.now(), name, query, standard: false }); saveEngines(); renderSearchEngines();
      document.getElementById('newEngineName').value = ''; document.getElementById('newEngineQuery').value = '';
    });

    document.getElementById('search-form').addEventListener('submit', (e) => {
      e.preventDefault(); const query = document.getElementById('search-input').value.trim(); if (!query) return;
      if (query.match(/^https?:\/\//) || query.match(/^[a-z0-9-]+\.[a-z]{2,}/)) { window.open(query.startsWith('http') ? query : 'https://' + query, '_blank'); } 
      else { const eng = searchEngines.find(x => x.id === settings.searchEngineId) || searchEngines[0]; window.open(eng.query + encodeURIComponent(query), '_blank'); }
      document.getElementById('search-input').value = ''; document.getElementById('searchSuggestions').classList.remove('active'); document.getElementById('searchDropdown').classList.remove('active');
    });

    document.getElementById('searchSuggestionsToggle').addEventListener('change', (e) => { settings.searchSuggestions = e.target.checked; if (!settings.searchSuggestions) document.getElementById('searchSuggestions').classList.remove('active'); saveSettings(); });
    document.getElementById('clockEnableToggle').addEventListener('change', (e) => { settings.clock.enabled = e.target.checked; saveSettings(); applyThemeAndBackground(); });
    document.getElementById('clockScaleSlider').addEventListener('input', (e) => { settings.clock.size = e.target.value; document.getElementById('clockScaleVal').innerText = settings.clock.size; saveSettings(); applyClockAesthetics(); });
    
    document.querySelectorAll('input[name="clockFormatToggle"]').forEach(r => r.addEventListener('change', (e) => { settings.clock.format = e.target.value; saveSettings(); startClock(); }));
    document.querySelectorAll('input[name="clockColorMode"]').forEach(r => r.addEventListener('change', (e) => { settings.clock.colorMode = e.target.value; document.getElementById('clockManualColorGroup').style.display = settings.clock.colorMode === 'manual' ? 'block' : 'none'; saveSettings(); applyClockAesthetics(); }));
    document.getElementById('clockManualColor').addEventListener('input', (e) => { settings.clock.manualColor = e.target.value; applyClockAesthetics(); });

    const tBg = t => { document.getElementById('gradientGroup').style.display = t === 'gradient' ? 'block' : 'none'; document.getElementById('customColorGroup').style.display = t === 'color' ? 'block' : 'none'; document.getElementById('imageUrlGroup').style.display = t === 'image' ? 'block' : 'none'; document.getElementById('uploadGroup').style.display = t === 'upload' ? 'block' : 'none'; };
    
    document.getElementById('bgType').addEventListener('change', (e) => { settings.bgType = e.target.value; tBg(e.target.value); applyThemeAndBackground(); saveSettings(); });
    document.getElementById('bgPreset').addEventListener('change', (e) => { settings.background = e.target.value; applyThemeAndBackground(); saveSettings(); });
    document.getElementById('customColor').addEventListener('input', (e) => { settings.customColor = e.target.value; applyThemeAndBackground(); saveSettings(); });
    document.getElementById('bgImageUrl').addEventListener('input', (e) => { settings.imageUrl = e.target.value; settings.uploadData = null; applyThemeAndBackground(); saveSettings(); });
    
    document.getElementById('bgImageUpload').addEventListener('change', (e) => { 
      const f = e.target.files[0]; 
      if (f) { 
        if (f.size > 50 * 1024 * 1024) return alert('Image is too massive (>50MB). It might crash your browser.'); 
    
        const objectUrl = URL.createObjectURL(f);
        const img = new Image();
    
        img.onload = async () => {
          URL.revokeObjectURL(objectUrl);
    
          const MAX_WIDTH = 2560;
          const MAX_HEIGHT = 1440;
          let width = img.width;
          let height = img.height;
    
          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }
    
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
    
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    
          settings.uploadData = compressedDataUrl; 
          settings.imageUrl = ''; 
          document.getElementById('imagePreview').style.backgroundImage = `url('${compressedDataUrl}')`; 
          document.getElementById('imagePreview').style.display = 'block'; 
          
          applyThemeAndBackground(); 
          saveSettings(); 
          await saveImgToDB(compressedDataUrl); 
        };
    
        img.src = objectUrl;
      } 
    });
    
    document.getElementById('autoThemeToggle').addEventListener('change', (e) => { settings.autoTheme = e.target.checked; document.getElementById('accentColorPickerGroup').style.display = settings.autoTheme ? 'none' : 'block'; applyThemeAndBackground(); saveSettings(); });
    document.getElementById('manualAccentColor').addEventListener('input', (e) => { settings.manualAccentColor = e.target.value; applyThemeAndBackground(); saveSettings(); });
    document.getElementById('acrylicBlurSlider').addEventListener('input', (e) => { settings.acrylicBlur = e.target.value; document.getElementById('acrylicBlurVal').innerText = settings.acrylicBlur + 'px'; applyThemeAndBackground(); saveSettings(); });
    document.getElementById('panelCurvatureSlider').addEventListener('input', (e) => { settings.panelCurvature = parseInt(e.target.value); document.getElementById('panelCurvatureVal').innerText = settings.panelCurvature + 'px'; applyThemeAndBackground(); saveSettings(); });

    const pS=document.getElementById('panelScale'), iS=document.getElementById('iconScale');
    pS.addEventListener('input', (e) => { settings.panelScale=e.target.value; document.getElementById('panelScaleVal').innerText=settings.panelScale; if(settings.syncScale) { settings.iconScale=e.target.value; iS.value=e.target.value; document.getElementById('iconScaleVal').innerText=e.target.value; } applyThemeAndBackground(); saveSettings(); });
    iS.addEventListener('input', (e) => { settings.iconScale=e.target.value; document.getElementById('iconScaleVal').innerText=settings.iconScale; if(settings.syncScale) { settings.panelScale=e.target.value; pS.value=e.target.value; document.getElementById('panelScaleVal').innerText=e.target.value; } applyThemeAndBackground(); saveSettings(); });
    document.getElementById('syncScaleToggle').addEventListener('change', (e) => { settings.syncScale = e.target.checked; saveSettings(); });
    
    document.querySelectorAll('input[name="panelColorMode"]').forEach(r => r.addEventListener('change', (e) => { settings.panelColorMode = e.target.value; document.getElementById('panelManualColorGroup').style.display = settings.panelColorMode === 'manual' ? 'block' : 'none'; applyThemeAndBackground(); saveSettings(); }));
    document.getElementById('panelManualColor').addEventListener('input', (e) => { settings.panelManualColor = e.target.value; applyThemeAndBackground(); saveSettings(); });
    document.getElementById('panelOpacitySlider').addEventListener('input', (e) => { settings.panelOpacity = parseFloat(e.target.value); document.getElementById('panelOpacityVal').innerText = settings.panelOpacity.toFixed(2); applyThemeAndBackground(); saveSettings(); });
    document.getElementById('panelBrightnessSlider').addEventListener('input', (e) => { settings.panelBrightness = parseFloat(e.target.value); document.getElementById('panelBrightnessVal').innerText = settings.panelBrightness.toFixed(1); applyThemeAndBackground(); saveSettings(); });
  }

  function syncSettingsToUI() {
    document.getElementById('clockEnableToggle').checked = settings.clock.enabled; document.getElementById('clockOptions').style.display = settings.clock.enabled ? 'block' : 'none';
    document.getElementById('clockScaleSlider').value = settings.clock.size; document.getElementById('clockScaleVal').innerText = settings.clock.size;
    
    const fMode = document.querySelector(`input[name="clockFormatToggle"][value="${settings.clock.format}"]`); if(fMode) fMode.checked = true;
    document.getElementById('clockManualColor').value = settings.clock.manualColor; document.getElementById('clockManualColorGroup').style.display = settings.clock.colorMode === 'manual' ? 'block' : 'none';
    const cMode = document.querySelector(`input[name="clockColorMode"][value="${settings.clock.colorMode}"]`); if(cMode) cMode.checked = true;
    document.getElementById('searchSuggestionsToggle').checked = settings.searchSuggestions !== false;

    document.getElementById('bgType').value = settings.bgType; document.getElementById('bgType').dispatchEvent(new Event('change'));
    if (settings.bgType==='gradient') { let presetElem = document.getElementById('bgPreset'); presetElem.value = settings.background; if(!presetElem.value) presetElem.selectedIndex = 0; } 
    else if (settings.bgType==='color') { document.getElementById('customColor').value = settings.customColor; } 
    else if (settings.bgType==='image') { document.getElementById('bgImageUrl').value = settings.imageUrl || ''; } 
    else if (settings.bgType==='upload' && settings.uploadData) { document.getElementById('imagePreview').style.backgroundImage = `url('${settings.uploadData}')`; document.getElementById('imagePreview').style.display='block'; }
    
    document.getElementById('autoThemeToggle').checked = settings.autoTheme; document.getElementById('manualAccentColor').value = settings.manualAccentColor; document.getElementById('accentColorPickerGroup').style.display = settings.autoTheme ? 'none' : 'block';
    let curveVal = parseInt(settings.panelCurvature); if (isNaN(curveVal)) curveVal = 32; document.getElementById('panelCurvatureSlider').value = curveVal; document.getElementById('panelCurvatureVal').innerText = curveVal + 'px';
    
    document.getElementById('panelScale').value = settings.panelScale; document.getElementById('iconScale').value = settings.iconScale; document.getElementById('panelScaleVal').innerText = settings.panelScale; document.getElementById('iconScaleVal').innerText = settings.iconScale; document.getElementById('syncScaleToggle').checked = settings.syncScale;
    document.getElementById('acrylicBlurSlider').value = settings.acrylicBlur; document.getElementById('acrylicBlurVal').innerText = settings.acrylicBlur + 'px';

    document.querySelector(`input[name="panelColorMode"][value="${settings.panelColorMode}"]`).checked = true; document.getElementById('panelManualColorGroup').style.display = settings.panelColorMode === 'manual' ? 'block' : 'none'; document.getElementById('panelManualColor').value = settings.panelManualColor; document.getElementById('panelOpacitySlider').value = settings.panelOpacity; document.getElementById('panelOpacityVal').innerText = settings.panelOpacity.toFixed(2); document.getElementById('panelBrightnessSlider').value = settings.panelBrightness; document.getElementById('panelBrightnessVal').innerText = settings.panelBrightness.toFixed(1);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    loadData(); syncSettingsToUI(); renderFavorites(); renderSearchEngines(); applyThemeAndBackground(); setupUIEvents();
    try {
      const imgData = await loadImgFromDB();
      if (imgData) {
        settings.uploadData = imgData;
        if (settings.bgType === 'upload') { applyThemeAndBackground(); syncSettingsToUI(); }
      }
    } catch(e) { console.warn("Could not load DB Image", e); }
  });
})();