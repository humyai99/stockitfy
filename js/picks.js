/**
 * AI Stock Recommendations - Frontend Logic
 */

(function () {
    'use strict';

    const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
    const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

    // ===================================
    // Initialize
    // ===================================
    document.addEventListener('DOMContentLoaded', function () {
        initPage();
        initMobileMenu();
        loadStockPicks();
        startClock();

        // Setup refresh button
        const refreshBtn = document.getElementById('refresh-all');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                refreshBtn.classList.add('loading');
                loadStockPicks().finally(() => {
                    setTimeout(() => refreshBtn.classList.remove('loading'), 500);
                });
            });
        }

        // Auto refresh
        setInterval(loadStockPicks, REFRESH_INTERVAL);
    });

    function initPage() {
        updateConnectionStatus();
        initSearch();
    }

    // ===================================
    // Search Functionality
    // ===================================
    function initSearch() {
        const searchInput = document.getElementById('stock-search');
        const searchBtn = document.getElementById('search-btn');
        const resultsContainer = document.getElementById('search-results');

        if (!searchInput || !searchBtn) return;

        searchBtn.addEventListener('click', () => performSearch());
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });

        async function performSearch() {
            const symbol = searchInput.value.trim().toUpperCase();
            if (!symbol) return;

            searchBtn.classList.add('loading');
            searchBtn.disabled = true;
            resultsContainer.innerHTML = '';

            try {
                const response = await fetch(`${API_BASE}/api/analyze-stock/${symbol}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'ไม่พบข้อมูลหุ้น');
                }

                renderSearchResult(data);
            } catch (error) {
                resultsContainer.innerHTML = `
                    <div class="search-error">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">❌</div>
                        <div>${error.message}</div>
                    </div>
                `;
            } finally {
                searchBtn.classList.remove('loading');
                searchBtn.disabled = false;
            }
        }
    }

    function renderSearchResult(stock) {
        const container = document.getElementById('search-results');
        const changeClass = stock.changePercent >= 0 ? 'positive' : 'negative';
        const changeSign = stock.changePercent >= 0 ? '+' : '';
        const scoreClass = stock.aiScore >= 60 ? 'high' : stock.aiScore >= 40 ? 'medium' : 'low';

        const analysisHtml = stock.analysis.map(point => `<li>${point}</li>`).join('');

        container.innerHTML = `
            <div class="search-result-card">
                <div class="search-result-header">
                    <div class="search-result-info">
                        <div class="result-symbol">${stock.symbol}</div>
                        <div class="result-name">${stock.name}</div>
                    </div>
                    <div class="result-price-group">
                        <div class="result-price">$${stock.price.toFixed(2)}</div>
                        <div class="result-change ${changeClass}">${changeSign}${stock.changePercent.toFixed(2)}%</div>
                    </div>
                </div>
                
                <div class="search-result-body">
                    <div class="result-score-section">
                        <div class="ai-score-display">
                            <div class="ai-score-value ${scoreClass}">${stock.aiScore}</div>
                            <div class="ai-score-label">AI Score</div>
                        </div>
                        <div class="result-rating-box">
                            <div class="result-rating ${stock.ratingClass}">${stock.rating}</div>
                            <div class="result-horizon ${stock.horizon}">${stock.horizonThai}</div>
                        </div>
                    </div>
                    
                    <div class="result-analysis-section">
                        <div class="result-analysis-title">📊 วิเคราะห์</div>
                        <ul class="result-analysis-list">${analysisHtml}</ul>
                    </div>
                    
                    <div class="result-recommendation">
                        <div class="recommendation-text">💡 ${stock.recommendation}</div>
                        <div class="result-entry-exit">
                            <div class="entry-label">🎯 เข้าซื้อ: <strong>$${stock.entryPoint}</strong></div>
                            <div class="exit-label">🏁 เป้าหมาย: <strong>$${stock.exitPoint}</strong></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

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

        navTabs.querySelectorAll('.nav-tab').forEach(tab => {
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
    // Load Stock Picks
    // ===================================
    async function loadStockPicks() {
        try {
            const response = await fetch(`${API_BASE}/api/stock-picks`);
            if (!response.ok) throw new Error('API Error');

            const data = await response.json();

            // Update market mood
            updateMarketMood(data.marketMood);

            // Render each section
            renderStockCards('daily-picks', data.dailyPicks.picks);
            renderStockCards('momentum-stocks', data.momentum.picks);
            renderStockCards('value-picks', data.valuePicks.picks);
            renderStockCards('watchout-stocks', data.watchout.picks);

            // Update timestamp
            document.getElementById('update-time').textContent = new Date().toLocaleTimeString('th-TH');
            updateConnectionStatus(true);

        } catch (error) {
            console.error('Failed to load stock picks:', error);
            updateConnectionStatus(false);
            showErrorState();
        }
    }

    // ===================================
    // Update Market Mood
    // ===================================
    function updateMarketMood(mood) {
        if (!mood) return;

        const moodCard = document.querySelector('.mood-card');
        const emojiEl = document.getElementById('mood-emoji');
        const titleEl = document.getElementById('mood-title');
        const messageEl = document.getElementById('mood-message');
        const bullishEl = document.getElementById('bullish-count');
        const bearishEl = document.getElementById('bearish-count');
        const avgScoreEl = document.getElementById('avg-score');

        // Update content
        emojiEl.textContent = mood.emoji;
        messageEl.textContent = mood.message;
        bullishEl.textContent = mood.bullish;
        bearishEl.textContent = mood.bearish;
        avgScoreEl.textContent = mood.avgScore;

        // Update title based on mood
        if (mood.mood === 'bullish') {
            titleEl.textContent = '🐂 Bullish Market';
            moodCard.className = 'mood-card bullish';
        } else if (mood.mood === 'bearish') {
            titleEl.textContent = '🐻 Bearish Market';
            moodCard.className = 'mood-card bearish';
        } else {
            titleEl.textContent = '😐 Neutral Market';
            moodCard.className = 'mood-card';
        }
    }

    // ===================================
    // Render Stock Cards
    // ===================================
    function renderStockCards(containerId, stocks) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!stocks || stocks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <p>ไม่พบหุ้นในหมวดนี้</p>
                </div>
            `;
            return;
        }

        container.innerHTML = stocks.map((stock, index) => {
            const changeClass = stock.changePercent >= 0 ? 'positive' : 'negative';
            const changeSign = stock.changePercent >= 0 ? '+' : '';
            const scoreClass = stock.aiScore >= 60 ? 'high' : stock.aiScore >= 40 ? 'medium' : 'low';
            const riskClass = stock.riskLevel || 'medium';
            const cardId = `${containerId}-card-${index}`;

            // Build analysis HTML
            const analysisHtml = stock.analysis && stock.analysis.length > 0
                ? stock.analysis.map(point => `<li>${point}</li>`).join('')
                : '';

            return `
                <div class="stock-card-wrapper">
                    <div class="stock-card" onclick="toggleCardDetails('${cardId}')">
                        <div class="card-main">
                            <div class="card-symbol">${stock.symbol}</div>
                            <div class="card-info">
                                <div class="card-name">${stock.name}</div>
                                <div class="card-horizon ${stock.horizon || ''}">${stock.horizonThai || ''}</div>
                            </div>
                            <div class="card-price-group">
                                <div class="card-price">$${formatPrice(stock.price)}</div>
                                <div class="card-change ${changeClass}">${changeSign}${stock.changePercent.toFixed(2)}%</div>
                            </div>
                            <div class="card-score">
                                <span class="score-value ${scoreClass}">${stock.aiScore}</span>
                                <span class="score-label ${stock.ratingClass}">${stock.rating}</span>
                            </div>
                        </div>
                        ${stock.reason ? `<div class="card-reason">${stock.reason}</div>` : ''}
                        ${stock.recommendation ? `<div class="card-recommendation">💡 ${stock.recommendation}</div>` : ''}
                    </div>
                    <div class="card-details" id="${cardId}">
                        <div class="details-header">📊 วิเคราะห์เพิ่มเติม</div>
                        <ul class="analysis-list">${analysisHtml}</ul>
                        ${stock.entryPoint ? `
                        <div class="entry-exit">
                            <div class="entry-point">🎯 จุดเข้าซื้อ: <strong>$${stock.entryPoint}</strong></div>
                            <div class="exit-point">🏁 เป้าหมาย: <strong>$${stock.exitPoint}</strong></div>
                        </div>
                        ` : ''}
                        <div class="risk-badge ${riskClass}">ความเสี่ยง: ${getRiskLabel(stock.riskLevel)}</div>
                        <button class="view-details-btn" onclick="event.stopPropagation(); window.location.href='analyzer.html?symbol=${stock.symbol}'">
                            📈 ดูกราฟและวิเคราะห์เพิ่มเติม
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function toggleCardDetails(cardId) {
        const details = document.getElementById(cardId);
        if (details) {
            details.classList.toggle('open');
        }
    }

    function getRiskLabel(level) {
        const labels = {
            'low': 'ต่ำ 🟢',
            'medium': 'ปานกลาง 🟡',
            'high': 'สูง 🟠',
            'very-high': 'สูงมาก 🔴'
        };
        return labels[level] || 'ปานกลาง 🟡';
    }

    // Make toggleCardDetails globally accessible
    window.toggleCardDetails = toggleCardDetails;

    // ===================================
    // Helper Functions
    // ===================================
    function formatPrice(price) {
        if (price >= 1000) return price.toFixed(0);
        if (price >= 100) return price.toFixed(1);
        return price.toFixed(2);
    }

    function updateConnectionStatus(connected = null) {
        const statusEl = document.getElementById('connection-status');
        if (!statusEl) return;

        if (connected === true) {
            statusEl.classList.add('connected');
            statusEl.querySelector('.status-text').textContent = 'Live Data';
        } else if (connected === false) {
            statusEl.classList.remove('connected');
            statusEl.querySelector('.status-text').textContent = 'Offline';
        } else {
            setTimeout(() => {
                statusEl.classList.add('connected');
                statusEl.querySelector('.status-text').textContent = 'Live Data';
            }, 1000);
        }
    }

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

    function showErrorState() {
        const containers = ['daily-picks', 'momentum-stocks', 'value-picks', 'watchout-stocks'];
        containers.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">⚠️</div>
                        <p>ไม่สามารถโหลดข้อมูลได้</p>
                    </div>
                `;
            }
        });
    }

    console.log('🤖 AI Stock Recommendations loaded');

})();
