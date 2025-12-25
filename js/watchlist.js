/**
 * AI Watchlist & Options Flow - Frontend Logic
 */

(function () {
    'use strict';

    const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
    const STORAGE_KEY = 'stockify_watchlist';
    const ALERTS_KEY = 'stockify_alerts';

    // ===================================
    // Initialize
    // ===================================
    document.addEventListener('DOMContentLoaded', function () {
        initMobileMenu();
        initAddStock();
        loadWatchlist();
        loadOptionsFlow();
        loadAlerts();
        startClock();
        updateConnectionStatus();

        // Refresh options button
        document.getElementById('refresh-options')?.addEventListener('click', loadOptionsFlow);
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

        navTabs.querySelectorAll('.nav-link').forEach(tab => {
            tab.addEventListener('click', () => {
                menuBtn.classList.remove('active');
                navTabs.classList.remove('open');
            });
        });

        document.addEventListener('click', (e) => {
            if (!menuBtn.contains(e.target) && !navTabs.contains(e.target)) {
                menuBtn.classList.remove('active');
                navTabs.classList.remove('open');
            }
        });
    }

    // ===================================
    // Add Stock Functionality
    // ===================================
    function initAddStock() {
        const input = document.getElementById('add-stock-input');
        const btn = document.getElementById('add-stock-btn');

        if (!input || !btn) return;

        btn.addEventListener('click', () => addStock(input.value));
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addStock(input.value);
        });
    }

    async function addStock(symbol) {
        symbol = symbol.trim().toUpperCase();
        if (!symbol) return;

        const watchlist = getWatchlist();
        if (watchlist.find(s => s.symbol === symbol)) {
            alert('หุ้นนี้อยู่ใน Watchlist แล้ว');
            return;
        }

        try {
            // Fetch stock data
            const response = await fetch(`${API_BASE}/api/analyze-stock/${symbol}`);
            if (!response.ok) throw new Error('ไม่พบหุ้นนี้');

            const stock = await response.json();

            // Add to watchlist
            watchlist.push({
                symbol: stock.symbol,
                name: stock.name,
                addedAt: Date.now()
            });

            saveWatchlist(watchlist);
            loadWatchlist();

            // Clear input
            document.getElementById('add-stock-input').value = '';

        } catch (error) {
            alert(error.message);
        }
    }

    function removeStock(symbol) {
        let watchlist = getWatchlist();
        watchlist = watchlist.filter(s => s.symbol !== symbol);
        saveWatchlist(watchlist);
        loadWatchlist();
    }

    // ===================================
    // Watchlist Storage
    // ===================================
    function getWatchlist() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch {
            return [];
        }
    }

    function saveWatchlist(list) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    // ===================================
    // Load & Render Watchlist
    // ===================================
    async function loadWatchlist() {
        const grid = document.getElementById('watchlist-grid');
        const countEl = document.getElementById('stock-count');
        const watchlist = getWatchlist();

        countEl.textContent = `${watchlist.length} หุ้น`;

        if (watchlist.length === 0) {
            grid.innerHTML = `
                <div class="empty-watchlist">
                    <div class="empty-icon">📭</div>
                    <p>ยังไม่มีหุ้นใน Watchlist</p>
                    <p class="empty-hint">พิมพ์ชื่อหุ้นด้านบนแล้วกด "เพิ่ม"</p>
                </div>
            `;
            return;
        }

        // Fetch all stocks data
        grid.innerHTML = '<div class="loading-placeholder">กำลังโหลด...</div>';

        const stockData = await Promise.all(
            watchlist.map(async (item) => {
                try {
                    const res = await fetch(`${API_BASE}/api/analyze-stock/${item.symbol}`);
                    return res.ok ? await res.json() : null;
                } catch {
                    return null;
                }
            })
        );

        const validStocks = stockData.filter(s => s !== null);

        if (validStocks.length === 0) {
            grid.innerHTML = `<div class="empty-watchlist"><p>ไม่สามารถโหลดข้อมูลได้</p></div>`;
            return;
        }

        grid.innerHTML = validStocks.map(stock => renderWatchlistCard(stock)).join('');

        // Add event listeners
        grid.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeStock(btn.dataset.symbol);
            });
        });

        grid.querySelectorAll('.alert-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                addAlert(btn.dataset.symbol);
            });
        });

        grid.querySelectorAll('.watchlist-card').forEach(card => {
            card.addEventListener('click', () => {
                window.location.href = `analyzer.html?symbol=${card.dataset.symbol}`;
            });
        });
    }

    function renderWatchlistCard(stock) {
        const changeClass = stock.changePercent >= 0 ? 'positive' : 'negative';
        const changeSign = stock.changePercent >= 0 ? '+' : '';
        const scoreClass = stock.aiScore >= 60 ? 'high' : stock.aiScore >= 40 ? 'medium' : 'low';

        return `
            <div class="watchlist-card" data-symbol="${stock.symbol}">
                <div class="watchlist-card-header">
                    <div class="card-stock-info">
                        <div class="card-symbol-box">${stock.symbol}</div>
                        <div class="card-name">${stock.name}</div>
                    </div>
                    <div class="card-actions">
                        <button class="action-btn alert-btn" data-symbol="${stock.symbol}" title="Add Alert">🔔</button>
                        <button class="action-btn remove remove-btn" data-symbol="${stock.symbol}" title="Remove">✕</button>
                    </div>
                </div>
                <div class="card-price-row">
                    <div class="card-price">$${stock.price.toFixed(2)}</div>
                    <div class="card-change ${changeClass}">${changeSign}${stock.changePercent.toFixed(2)}%</div>
                </div>
                <div class="card-ai-row">
                    <div class="card-ai-score">
                        <div class="ai-score-value ${scoreClass}">${stock.aiScore}</div>
                        <div class="ai-rating ${stock.ratingClass}">${stock.rating}</div>
                    </div>
                    <div class="card-horizon ${stock.horizon}">${stock.horizonThai}</div>
                </div>
            </div>
        `;
    }

    // ===================================
    // Alerts System
    // ===================================
    function getAlerts() {
        try {
            return JSON.parse(localStorage.getItem(ALERTS_KEY) || '[]');
        } catch {
            return [];
        }
    }

    function saveAlerts(alerts) {
        localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
    }

    function addAlert(symbol) {
        const condition = prompt(`ตั้ง Alert สำหรับ ${symbol}\n\nเลือกประเภท:\n1. ราคาถึง (พิมพ์: price > 200)\n2. RSI (พิมพ์: rsi < 30)\n\nตัวอย่าง: price > 200`, 'price > 0');

        if (!condition) return;

        const alerts = getAlerts();
        alerts.push({
            id: Date.now(),
            symbol,
            condition,
            createdAt: Date.now(),
            active: true
        });

        saveAlerts(alerts);
        loadAlerts();
    }

    function removeAlert(id) {
        let alerts = getAlerts();
        alerts = alerts.filter(a => a.id !== id);
        saveAlerts(alerts);
        loadAlerts();
    }

    function loadAlerts() {
        const container = document.getElementById('alerts-list');
        const countEl = document.getElementById('alert-count');
        const alerts = getAlerts();

        countEl.textContent = `${alerts.length} alerts`;

        if (alerts.length === 0) {
            container.innerHTML = `
                <div class="no-alerts">
                    <div class="no-alerts-icon">🔕</div>
                    <p>ยังไม่มี Alerts</p>
                </div>
            `;
            return;
        }

        container.innerHTML = alerts.map(alert => `
            <div class="alert-item">
                <div class="alert-info">
                    <span class="alert-symbol">${alert.symbol}</span>
                    <span class="alert-condition">${alert.condition}</span>
                </div>
                <button class="alert-delete" data-id="${alert.id}">🗑️</button>
            </div>
        `).join('');

        container.querySelectorAll('.alert-delete').forEach(btn => {
            btn.addEventListener('click', () => removeAlert(parseInt(btn.dataset.id)));
        });
    }

    // ===================================
    // Options Flow (Real Data from API)
    // ===================================
    async function loadOptionsFlow() {
        const tbody = document.getElementById('options-tbody');
        tbody.innerHTML = '<tr><td colspan="7" class="loading-row">กำลังดึงข้อมูล Options realtime...</td></tr>';

        try {
            const response = await fetch(`${API_BASE}/api/options-flow`);
            if (!response.ok) throw new Error('Failed to fetch options');

            const data = await response.json();
            updateOptionsUI(data);

        } catch (error) {
            console.error('Options flow error:', error);
            tbody.innerHTML = '<tr><td colspan="7" class="loading-row">❌ ไม่สามารถโหลดข้อมูลได้</td></tr>';
        }
    }

    function updateOptionsUI(data) {
        // Update summary cards
        document.getElementById('bullish-flow').textContent = `$${data.bullishFlow}M`;
        document.getElementById('bearish-flow').textContent = `$${data.bearishFlow}M`;
        document.getElementById('put-call-ratio').textContent = data.putCallRatio;
        document.getElementById('market-mood-text').textContent = data.mood;

        // Render unusual activity table
        renderOptionsTable(data.unusualActivity || []);
    }

    function renderOptionsTable(options) {
        const tbody = document.getElementById('options-tbody');

        if (options.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading-row">ไม่พบ Unusual Activity ในขณะนี้</td></tr>';
            return;
        }

        tbody.innerHTML = options.map(opt => `
            <tr>
                <td class="option-symbol">${opt.symbol}</td>
                <td><span class="option-type ${opt.type.toLowerCase()}">${opt.type}</span></td>
                <td>$${opt.strike}</td>
                <td>${opt.expiry}</td>
                <td>${opt.volume.toLocaleString()}</td>
                <td>$${opt.premium}M</td>
                <td><span class="signal-badge ${opt.signal}">${opt.signal === 'bullish' ? '🐂 Bullish' : opt.signal === 'bearish' ? '🐻 Bearish' : '😐 Neutral'}</span></td>
            </tr>
        `).join('');
    }

    // ===================================
    // Utility Functions
    // ===================================
    function startClock() {
        function updateTime() {
            const el = document.getElementById('header-time');
            if (el) {
                el.textContent = new Date().toLocaleTimeString('th-TH');
            }
        }
        updateTime();
        setInterval(updateTime, 1000);
    }

    function updateConnectionStatus() {
        const statusEl = document.getElementById('connection-status');
        if (!statusEl) return;

        setTimeout(() => {
            statusEl.classList.add('connected');
            statusEl.querySelector('.status-text').textContent = 'Live Data';
        }, 1000);
    }

    // Expose functions for event handlers
    window.removeStock = removeStock;
    window.addAlert = addAlert;

    console.log('📊 Watchlist & Options Flow loaded');

})();
