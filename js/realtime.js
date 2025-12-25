// Stockify Pro AI - Real-time Dashboard JavaScript
// PWA + Simulated Real-time Data

(function () {
    'use strict';

    // ===================================
    // Configuration
    // ===================================
    const CONFIG = {
        UPDATE_INTERVAL: 3000, // 3 seconds for simulated data
        RECOMMENDATIONS_INTERVAL: 30000, // 30 seconds for recommendations
        INDICES_INTERVAL: 10000, // 10 seconds for indices
        TICKER_SPEED: 30, // seconds for full scroll
        PRICE_VOLATILITY: 0.002, // 0.2% max change per update
        API_BASE: window.location.hostname === 'localhost' ? 'http://localhost:3001' : '',
    };

    // ===================================
    // Market Data Store
    // ===================================
    const marketData = {
        indices: {
            SPY: { name: 'S&P 500', price: 6051.09, change: 0.95, high: 6099.97, low: 6032.38, prevClose: 5994.10 },
            QQQ: { name: 'Nasdaq 100', price: 21622.25, change: 1.24, high: 21780.00, low: 21489.12, prevClose: 21357.35 },
            NKY: { name: 'Nikkei 225', price: 39470.44, change: 0.68, high: 39720.00, low: 39280.55, prevClose: 39203.25 },
            STOXX: { name: 'Euro Stoxx 50', price: 4977.50, change: -0.32, high: 5012.40, low: 4958.20, prevClose: 4993.50 },
            SET: { name: 'SET Index', price: 1432.18, change: 0.45, high: 1440.25, low: 1425.80, prevClose: 1425.74 },
            CNA50: { name: 'China A50', price: 13458.30, change: -0.85, high: 13620.00, low: 13410.50, prevClose: 13573.80 }
        },
        vix: { value: 13.81, change: -2.45, prevClose: 14.16 },
        fearGreed: { value: 72, label: 'Greed' },
        sectors: {
            XLK: { name: 'Technology', change: 2.15 },
            XLF: { name: 'Financials', change: 1.42 },
            XLV: { name: 'Healthcare', change: 0.85 },
            XLI: { name: 'Industrials', change: 0.65 },
            XLC: { name: 'Communication', change: 1.28 },
            XLY: { name: 'Consumer Disc.', change: 0.72 },
            XLP: { name: 'Consumer Staples', change: -0.12 },
            XLE: { name: 'Energy', change: -0.58 },
            XLU: { name: 'Utilities', change: -1.05 },
            XLRE: { name: 'Real Estate', change: -0.78 },
            XLB: { name: 'Materials', change: 0.15 }
        }
    };

    // ===================================
    // Initialize App
    // ===================================
    document.addEventListener('DOMContentLoaded', function () {
        initServiceWorker();
        initConnectionStatus();
        initMobileMenu();
        initTicker();
        initRealTimeUpdates();
        initInteractions();
        initPWAInstall();
        updateLastUpdateTime();
        checkMarketStatus();
        initStockPicks(); // AI Stock Recommendations
        initLiveIndices(); // Live indices from API
    });

    // ===================================
    // Mobile Menu
    // ===================================
    function initMobileMenu() {
        const menuBtn = document.getElementById('mobile-menu-btn');
        const navTabs = document.getElementById('nav-tabs');

        if (!menuBtn || !navTabs) return;

        menuBtn.addEventListener('click', () => {
            menuBtn.classList.toggle('active');
            navTabs.classList.toggle('open');
        });

        // Close menu when clicking a link
        navTabs.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                menuBtn.classList.remove('active');
                navTabs.classList.remove('open');
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!menuBtn.contains(e.target) && !navTabs.contains(e.target)) {
                menuBtn.classList.remove('active');
                navTabs.classList.remove('open');
            }
        });
    }

    // ===================================
    // Service Worker Registration
    // ===================================
    function initServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('[App] Service Worker registered:', registration.scope);
                })
                .catch(error => {
                    console.error('[App] Service Worker registration failed:', error);
                });
        }
    }

    // ===================================
    // Connection Status
    // ===================================
    function initConnectionStatus() {
        const statusEl = document.getElementById('connection-status');

        // Simulate connection
        setTimeout(() => {
            statusEl.classList.add('connected');
            statusEl.querySelector('.status-text').textContent = 'Live Data';
        }, 1500);

        // Handle online/offline
        window.addEventListener('online', () => {
            statusEl.classList.remove('disconnected');
            statusEl.classList.add('connected');
            statusEl.querySelector('.status-text').textContent = 'Live Data';
        });

        window.addEventListener('offline', () => {
            statusEl.classList.remove('connected');
            statusEl.classList.add('disconnected');
            statusEl.querySelector('.status-text').textContent = 'Offline - Using Cached Data';
        });
    }

    // ===================================
    // Market Status
    // ===================================
    function checkMarketStatus() {
        const now = new Date();
        const hour = now.getUTCHours();
        const day = now.getUTCDay();

        const statusDot = document.getElementById('market-status-dot');
        const statusText = document.getElementById('market-status-text');

        // US Market hours (9:30 AM - 4:00 PM ET = 14:30 - 21:00 UTC)
        const isWeekday = day >= 1 && day <= 5;
        const isMarketHours = hour >= 14 && hour < 21;

        if (isWeekday && isMarketHours) {
            statusDot.classList.remove('closed');
            statusDot.classList.add('open');
            statusText.textContent = 'Market Open';
        } else {
            statusDot.classList.remove('open');
            statusDot.classList.add('closed');
            statusText.textContent = 'Market Closed';
        }
    }

    // ===================================
    // Ticker Strip
    // ===================================
    function initTicker() {
        const tickerContent = document.getElementById('ticker-content');
        if (!tickerContent) return;

        const tickerData = [
            { symbol: 'SPY', name: 'S&P 500' },
            { symbol: 'QQQ', name: 'Nasdaq' },
            { symbol: 'DIA', name: 'Dow Jones', price: 43828.06, change: 0.72 },
            { symbol: 'IWM', name: 'Russell 2000', price: 2368.45, change: 1.15 },
            { symbol: 'GLD', name: 'Gold', price: 2657.30, change: 0.28 },
            { symbol: 'USO', name: 'Crude Oil', price: 70.58, change: -1.23 },
            { symbol: 'TLT', name: '20Y Treasury', price: 89.42, change: -0.45 },
            { symbol: 'DXY', name: 'Dollar Index', price: 107.12, change: 0.18 },
            { symbol: 'BTC', name: 'Bitcoin', price: 101842.50, change: 2.85 },
            { symbol: 'ETH', name: 'Ethereum', price: 3892.25, change: 3.12 },
        ];

        function renderTicker() {
            let html = '';
            const items = [...tickerData, ...tickerData]; // Duplicate for seamless scroll

            items.forEach(item => {
                const data = marketData.indices[item.symbol] || item;
                const price = data.price || item.price;
                const change = data.change || item.change;
                const isPositive = change >= 0;

                html += `
                    <div class="ticker-item">
                        <span class="ticker-symbol">${item.symbol}</span>
                        <span class="ticker-price">${formatNumber(price)}</span>
                        <span class="ticker-change ${isPositive ? 'positive' : 'negative'}">
                            ${isPositive ? '+' : ''}${change.toFixed(2)}%
                        </span>
                    </div>
                `;
            });

            tickerContent.innerHTML = html;
        }

        renderTicker();

        // Update ticker periodically
        setInterval(renderTicker, CONFIG.UPDATE_INTERVAL);
    }

    // ===================================
    // Real-time Price Updates
    // ===================================
    function initRealTimeUpdates() {
        setInterval(() => {
            updatePrices();
            updateVIX();
            updateFearGreed();
            updateLastUpdateTime();
        }, CONFIG.UPDATE_INTERVAL);
    }

    function updatePrices() {
        Object.keys(marketData.indices).forEach(symbol => {
            const data = marketData.indices[symbol];

            // Simulate price movement
            const changePercent = (Math.random() - 0.5) * 2 * CONFIG.PRICE_VOLATILITY;
            const priceChange = data.price * changePercent;

            data.price = parseFloat((data.price + priceChange).toFixed(2));
            data.change = parseFloat((((data.price - data.prevClose) / data.prevClose) * 100).toFixed(2));

            // Update high/low
            if (data.price > data.high) data.high = data.price;
            if (data.price < data.low) data.low = data.price;

            // Update DOM
            updateIndexCard(symbol, data);
        });
    }

    function updateIndexCard(symbol, data) {
        const symbolLower = symbol.toLowerCase();
        const priceEl = document.getElementById(`${symbolLower}-price`);
        const changeEl = document.getElementById(`${symbolLower}-change`);
        const highEl = document.getElementById(`${symbolLower}-high`);
        const lowEl = document.getElementById(`${symbolLower}-low`);

        if (priceEl) {
            const oldPrice = parseFloat(priceEl.textContent.replace(/,/g, ''));
            priceEl.textContent = formatNumber(data.price);

            // Flash animation
            if (data.price > oldPrice) {
                priceEl.classList.remove('price-flash-negative');
                priceEl.classList.add('price-flash-positive');
            } else if (data.price < oldPrice) {
                priceEl.classList.remove('price-flash-positive');
                priceEl.classList.add('price-flash-negative');
            }

            setTimeout(() => {
                priceEl.classList.remove('price-flash-positive', 'price-flash-negative');
            }, 500);
        }

        if (changeEl) {
            const isPositive = data.change >= 0;
            changeEl.className = `price-change ${isPositive ? 'positive' : 'negative'}`;
            changeEl.innerHTML = `
                <span class="change-value">${isPositive ? '+' : ''}${data.change.toFixed(2)}%</span>
                <span class="change-arrow">${isPositive ? '▲' : '▼'}</span>
            `;
        }

        if (highEl) highEl.textContent = formatNumber(data.high);
        if (lowEl) lowEl.textContent = formatNumber(data.low);
    }

    function updateVIX() {
        const vix = marketData.vix;

        // Simulate VIX movement
        const vixChange = (Math.random() - 0.5) * 0.5;
        vix.value = parseFloat(Math.max(10, Math.min(30, vix.value + vixChange)).toFixed(2));
        vix.change = parseFloat((((vix.value - vix.prevClose) / vix.prevClose) * 100).toFixed(2));

        // Update DOM
        const vixValueEl = document.getElementById('vix-value');
        const vixChangeEl = document.getElementById('vix-change');
        const vixGaugeFill = document.getElementById('vix-gauge-fill');
        const vixIndicator = document.getElementById('vix-indicator');

        if (vixValueEl) vixValueEl.textContent = vix.value.toFixed(2);
        if (vixChangeEl) {
            const isDown = vix.change < 0;
            vixChangeEl.className = `vix-change ${isDown ? 'positive' : 'negative'}`;
            vixChangeEl.innerHTML = `<span>${vix.change >= 0 ? '+' : ''}${vix.change.toFixed(2)}%</span>`;
        }

        // Update gauge (0-50 scale)
        const gaugePercent = Math.min(100, (vix.value / 50) * 100);
        if (vixGaugeFill) vixGaugeFill.style.width = `${gaugePercent}%`;
        if (vixIndicator) vixIndicator.style.left = `${gaugePercent}%`;

        // Update status
        const vixStatus = document.getElementById('vix-status');
        if (vixStatus) {
            let status, statusClass, note;
            if (vix.value < 15) {
                status = 'Extreme Greed';
                statusClass = 'low';
                note = 'ตลาดมีความมั่นใจสูง - ระวัง Complacency';
            } else if (vix.value < 20) {
                status = 'Low Fear';
                statusClass = 'low';
                note = 'ความผันผวนต่ำกว่าปกติ';
            } else if (vix.value < 25) {
                status = 'Moderate';
                statusClass = 'medium';
                note = 'ความผันผวนปกติ';
            } else {
                status = 'High Fear';
                statusClass = 'high';
                note = 'ตลาดมีความกังวลสูง';
            }

            vixStatus.innerHTML = `
                <span class="status-badge ${statusClass}">${status}</span>
                <span class="status-note">${note}</span>
            `;

            // Update VIX value color
            if (vixValueEl) {
                vixValueEl.style.color = vix.value < 20 ? 'var(--positive)' :
                    vix.value < 25 ? 'var(--warning)' : 'var(--negative)';
            }
        }
    }

    function updateFearGreed() {
        const fg = marketData.fearGreed;

        // Simulate small changes
        const fgChange = (Math.random() - 0.5) * 3;
        fg.value = Math.max(0, Math.min(100, Math.round(fg.value + fgChange)));

        // Update label
        if (fg.value < 25) fg.label = 'Extreme Fear';
        else if (fg.value < 45) fg.label = 'Fear';
        else if (fg.value < 55) fg.label = 'Neutral';
        else if (fg.value < 75) fg.label = 'Greed';
        else fg.label = 'Extreme Greed';

        // Update DOM
        const fgValueEl = document.getElementById('fg-value');
        const fgLabelEl = document.getElementById('fg-label');
        const fgNeedle = document.getElementById('fg-needle');

        if (fgValueEl) fgValueEl.textContent = fg.value;
        if (fgLabelEl) {
            fgLabelEl.textContent = fg.label;

            // Update color
            let color;
            if (fg.value < 25) color = 'var(--negative)';
            else if (fg.value < 45) color = '#f97316';
            else if (fg.value < 55) color = 'var(--warning)';
            else if (fg.value < 75) color = '#84cc16';
            else color = 'var(--positive)';

            fgValueEl.style.color = color;
            fgLabelEl.style.color = color;
        }

        // Update needle rotation (0 = -90deg, 100 = 90deg)
        if (fgNeedle) {
            const rotation = (fg.value / 100) * 180 - 90;
            fgNeedle.setAttribute('transform', `rotate(${rotation}, 100, 100)`);
        }
    }

    function updateLastUpdateTime() {
        const el = document.getElementById('last-update-time');
        if (el) {
            const now = new Date();
            el.textContent = now.toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
    }

    // ===================================
    // Interactions
    // ===================================
    function initInteractions() {
        // Tab navigation
        document.querySelectorAll('.nav-tab, .bottom-nav-item').forEach(tab => {
            tab.addEventListener('click', function () {
                const tabGroup = this.closest('.nav-tabs, .bottom-nav');
                tabGroup.querySelectorAll('.nav-tab, .bottom-nav-item').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
            });
        });

        // Timeframe toggle
        document.querySelectorAll('.tf-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                this.closest('.timeframe-toggle').querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                // Could trigger data refresh here
            });
        });

        // View toggle
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                this.closest('.sparkline-toggle').querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            });
        });

        // Index card click
        document.querySelectorAll('.index-card').forEach(card => {
            card.addEventListener('click', function () {
                const symbol = this.dataset.symbol;
                console.log('Open chart for:', symbol);
                // Could open modal or navigate to chart page
            });
        });

        // Sector tile hover effect
        document.querySelectorAll('.sector-tile').forEach(tile => {
            tile.addEventListener('mouseenter', function () {
                this.style.zIndex = '10';
            });
            tile.addEventListener('mouseleave', function () {
                this.style.zIndex = '1';
            });
        });
    }

    // ===================================
    // PWA Install
    // ===================================
    let deferredPrompt;

    function initPWAInstall() {
        const installPrompt = document.getElementById('install-prompt');
        const installBtn = document.getElementById('install-btn');
        const dismissBtn = document.getElementById('install-dismiss');

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;

            // Show install prompt after 5 seconds
            setTimeout(() => {
                installPrompt.classList.remove('hidden');
            }, 5000);
        });

        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log('Install outcome:', outcome);
                    deferredPrompt = null;
                    installPrompt.classList.add('hidden');
                }
            });
        }

        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                installPrompt.classList.add('hidden');
            });
        }

        // Check if already installed
        window.addEventListener('appinstalled', () => {
            console.log('[App] PWA installed successfully');
            installPrompt.classList.add('hidden');
            deferredPrompt = null;
        });
    }

    // ===================================
    // Utilities
    // ===================================
    function formatNumber(num) {
        if (num >= 10000) {
            return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
        }
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatVolume(vol) {
        if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
        if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
        if (vol >= 1e3) return (vol / 1e3).toFixed(1) + 'K';
        return vol.toString();
    }

    // ===================================
    // AI Stock Picks
    // ===================================
    let backendAvailable = null;

    async function checkBackend() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/health`, { timeout: 3000 });
            backendAvailable = response.ok;
        } catch {
            backendAvailable = false;
        }
        return backendAvailable;
    }

    async function initStockPicks() {
        await checkBackend();
        fetchStockPicks();

        // Setup refresh button
        const refreshBtn = document.getElementById('refresh-picks');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                refreshBtn.classList.add('spinning');
                fetchStockPicks().finally(() => {
                    setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
                });
            });
        }

        // Auto-refresh
        setInterval(fetchStockPicks, CONFIG.RECOMMENDATIONS_INTERVAL);
    }

    async function fetchStockPicks() {
        const grid = document.getElementById('stock-picks-grid');
        const loading = document.getElementById('picks-loading');
        const updateTime = document.getElementById('picks-update-time');

        if (!grid) return;

        try {
            if (backendAvailable) {
                const response = await fetch(`${CONFIG.API_BASE}/api/recommendations`);
                if (!response.ok) throw new Error('API error');

                const data = await response.json();
                renderStockPicks(data.stocks);

                if (updateTime) {
                    updateTime.textContent = new Date().toLocaleTimeString('th-TH', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            } else {
                // Fallback to simulated data
                renderSimulatedPicks();
            }
        } catch (error) {
            console.warn('[Picks] Backend unavailable, using simulated data:', error.message);
            backendAvailable = false;
            renderSimulatedPicks();
        }

        if (loading) loading.style.display = 'none';
    }

    function renderStockPicks(stocks) {
        const grid = document.getElementById('stock-picks-grid');
        if (!grid || !stocks) return;

        // Remove loading
        const loading = grid.querySelector('.picks-loading');

        let html = '';
        stocks.forEach(stock => {
            const isPositive = stock.changePercent >= 0;
            const rsiClass = stock.indicators.rsi < 30 ? 'bullish' :
                stock.indicators.rsi > 70 ? 'bearish' : 'neutral';

            html += `
                <div class="stock-pick-card ${stock.ratingClass}" data-symbol="${stock.symbol}">
                    <div class="pick-header">
                        <div class="pick-info">
                            <span class="pick-symbol">${stock.symbol}</span>
                            <span class="pick-name">${stock.name}</span>
                        </div>
                        <span class="rating-badge ${stock.ratingClass}">${stock.rating}</span>
                    </div>
                    <div class="pick-price-row">
                        <span class="pick-price">$${formatNumber(stock.price)}</span>
                        <span class="pick-change ${isPositive ? 'positive' : 'negative'}">
                            ${isPositive ? '+' : ''}${stock.changePercent.toFixed(2)}%
                            ${isPositive ? '▲' : '▼'}
                        </span>
                    </div>
                    <div class="ai-score-container">
                        <div class="ai-score-label">
                            <span class="ai-score-text">AI Score</span>
                            <span class="ai-score-value">${stock.aiScore}/100</span>
                        </div>
                        <div class="ai-score-meter">
                            <div class="ai-score-fill ${stock.ratingClass}" style="width: ${stock.aiScore}%"></div>
                        </div>
                    </div>
                    <div class="pick-indicators">
                        <div class="indicator-mini">
                            <span class="label">RSI</span>
                            <span class="value ${rsiClass}">${stock.indicators.rsi}</span>
                        </div>
                        <div class="indicator-mini">
                            <span class="label">Vol</span>
                            <span class="value">${formatVolume(stock.volume)}</span>
                        </div>
                        <div class="indicator-mini">
                            <span class="label">MACD</span>
                            <span class="value ${stock.indicators.macd > 0 ? 'bullish' : 'bearish'}">
                                ${stock.indicators.macd > 0 ? '+' : ''}${stock.indicators.macd}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = html;
    }

    function renderSimulatedPicks() {
        const simulatedStocks = [
            { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 134.28, changePercent: 2.85, aiScore: 82, rating: 'Strong Buy', ratingClass: 'strong-buy', indicators: { rsi: 58, macd: 1.25 }, volume: 45200000 },
            { symbol: 'AAPL', name: 'Apple Inc.', price: 256.12, changePercent: 1.24, aiScore: 75, rating: 'Buy', ratingClass: 'buy', indicators: { rsi: 62, macd: 0.85 }, volume: 38500000 },
            { symbol: 'MSFT', name: 'Microsoft Corporation', price: 428.55, changePercent: 0.95, aiScore: 78, rating: 'Buy', ratingClass: 'buy', indicators: { rsi: 55, macd: 1.12 }, volume: 22100000 },
            { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 192.48, changePercent: 1.52, aiScore: 72, rating: 'Buy', ratingClass: 'buy', indicators: { rsi: 51, macd: 0.45 }, volume: 18900000 },
            { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 224.18, changePercent: 0.68, aiScore: 70, rating: 'Buy', ratingClass: 'buy', indicators: { rsi: 48, macd: 0.32 }, volume: 28700000 },
            { symbol: 'META', name: 'Meta Platforms Inc.', price: 612.85, changePercent: 1.85, aiScore: 76, rating: 'Buy', ratingClass: 'buy', indicators: { rsi: 64, macd: 2.15 }, volume: 15400000 },
            { symbol: 'TSLA', name: 'Tesla Inc.', price: 452.28, changePercent: -0.55, aiScore: 52, rating: 'Hold', ratingClass: 'hold', indicators: { rsi: 68, macd: -0.42 }, volume: 82300000 },
            { symbol: 'AMD', name: 'Advanced Micro Devices', price: 118.45, changePercent: 2.12, aiScore: 68, rating: 'Buy', ratingClass: 'buy', indicators: { rsi: 56, macd: 0.95 }, volume: 42100000 },
            { symbol: 'NFLX', name: 'Netflix Inc.', price: 928.72, changePercent: 0.42, aiScore: 58, rating: 'Hold', ratingClass: 'hold', indicators: { rsi: 72, macd: -0.18 }, volume: 5200000 },
            { symbol: 'AVGO', name: 'Broadcom Inc.', price: 235.68, changePercent: 1.95, aiScore: 74, rating: 'Buy', ratingClass: 'buy', indicators: { rsi: 54, macd: 1.45 }, volume: 8900000 }
        ];
        renderStockPicks(simulatedStocks);
    }

    // ===================================
    // Live Indices from API
    // ===================================
    async function initLiveIndices() {
        if (!backendAvailable) return;

        fetchLiveIndices();
        setInterval(fetchLiveIndices, CONFIG.INDICES_INTERVAL);
    }

    async function fetchLiveIndices() {
        if (!backendAvailable) return;

        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/indices`);
            if (!response.ok) throw new Error('API error');

            const data = await response.json();

            data.indices.forEach(idx => {
                updateIndexFromAPI(idx);
            });
        } catch (error) {
            console.warn('[Indices] API fetch failed:', error.message);
        }
    }

    function updateIndexFromAPI(idx) {
        const priceEl = document.getElementById(`${idx.id}-price`);
        const changeEl = document.getElementById(`${idx.id}-change`);
        const highEl = document.getElementById(`${idx.id}-high`);
        const lowEl = document.getElementById(`${idx.id}-low`);

        if (priceEl && idx.price) {
            const oldPrice = parseFloat(priceEl.textContent.replace(/,/g, ''));
            priceEl.textContent = formatNumber(idx.price);

            // Flash animation
            if (idx.price > oldPrice) {
                priceEl.classList.remove('price-flash-negative');
                priceEl.classList.add('price-flash-positive');
            } else if (idx.price < oldPrice) {
                priceEl.classList.remove('price-flash-positive');
                priceEl.classList.add('price-flash-negative');
            }

            setTimeout(() => {
                priceEl.classList.remove('price-flash-positive', 'price-flash-negative');
            }, 500);
        }

        if (changeEl && idx.changePercent !== undefined) {
            const isPositive = idx.changePercent >= 0;
            changeEl.className = `price-change ${isPositive ? 'positive' : 'negative'}`;
            changeEl.innerHTML = `
                <span class="change-value">${isPositive ? '+' : ''}${idx.changePercent.toFixed(2)}%</span>
                <span class="change-arrow">${isPositive ? '▲' : '▼'}</span>
            `;
        }

        if (highEl && idx.high) highEl.textContent = formatNumber(idx.high);
        if (lowEl && idx.low) lowEl.textContent = formatNumber(idx.low);

        // Update VIX specifically
        if (idx.id === 'vix') {
            updateVIXFromAPI(idx);
        }
    }

    function updateVIXFromAPI(idx) {
        const vixValueEl = document.getElementById('vix-value');
        const vixChangeEl = document.getElementById('vix-change');
        const vixGaugeFill = document.getElementById('vix-gauge-fill');
        const vixIndicator = document.getElementById('vix-indicator');
        const vixStatus = document.getElementById('vix-status');

        if (vixValueEl && idx.price) {
            vixValueEl.textContent = idx.price.toFixed(2);
            vixValueEl.style.color = idx.price < 20 ? 'var(--positive)' :
                idx.price < 25 ? 'var(--warning)' : 'var(--negative)';
        }

        if (vixChangeEl && idx.changePercent !== undefined) {
            const isDown = idx.changePercent < 0;
            vixChangeEl.className = `vix-change ${isDown ? 'positive' : 'negative'}`;
            vixChangeEl.innerHTML = `<span>${idx.changePercent >= 0 ? '+' : ''}${idx.changePercent.toFixed(2)}%</span>`;
        }

        // Update gauge
        const gaugePercent = Math.min(100, (idx.price / 50) * 100);
        if (vixGaugeFill) vixGaugeFill.style.width = `${gaugePercent}%`;
        if (vixIndicator) vixIndicator.style.left = `${gaugePercent}%`;

        // Update status
        if (vixStatus && idx.price) {
            let status, statusClass, note;
            if (idx.price < 15) {
                status = 'Extreme Greed';
                statusClass = 'low';
                note = 'ตลาดมีความมั่นใจสูง - ระวัง Complacency';
            } else if (idx.price < 20) {
                status = 'Low Fear';
                statusClass = 'low';
                note = 'ความผันผวนต่ำกว่าปกติ';
            } else if (idx.price < 25) {
                status = 'Moderate';
                statusClass = 'medium';
                note = 'ความผันผวนปกติ';
            } else {
                status = 'High Fear';
                statusClass = 'high';
                note = 'ตลาดมีความกังวลสูง';
            }

            vixStatus.innerHTML = `
                <span class="status-badge ${statusClass}">${status}</span>
                <span class="status-note">${note}</span>
            `;
        }
    }

    // ===================================
    // Expose for debugging
    // ===================================
    window.stockifyData = marketData;
    window.stockifyRefresh = fetchStockPicks;

})();

console.log('🚀 Stockify Pro AI - Real-time Dashboard Loaded');
