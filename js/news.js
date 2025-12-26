/**
 * News Feed - Frontend Logic
 */

(function () {
    'use strict';

    // ===================================
    // Configuration
    // ===================================
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE = isLocalhost ? 'http://localhost:3001' : '';

    // ===================================
    // State
    // ===================================
    let currentSymbol = 'AAPL';
    let newsData = [];

    // ===================================
    // DOM Elements
    // ===================================
    const newsGrid = document.getElementById('news-grid');
    const newsTitle = document.getElementById('news-title');
    const lastUpdate = document.getElementById('last-update');
    const refreshBtn = document.getElementById('refresh-btn');
    const positiveCount = document.getElementById('positive-count');
    const neutralCount = document.getElementById('neutral-count');
    const negativeCount = document.getElementById('negative-count');
    const customSymbolInput = document.getElementById('custom-symbol');
    const searchBtn = document.getElementById('search-btn');

    // ===================================
    // Initialize
    // ===================================
    function init() {
        // Event listeners
        refreshBtn.addEventListener('click', () => loadNews(currentSymbol));

        // Stock chips
        document.querySelectorAll('.stock-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.stock-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                currentSymbol = chip.dataset.symbol;
                loadNews(currentSymbol);
            });
        });

        // Custom search
        searchBtn.addEventListener('click', () => {
            const symbol = customSymbolInput.value.trim().toUpperCase();
            if (symbol) {
                document.querySelectorAll('.stock-chip').forEach(c => c.classList.remove('active'));
                currentSymbol = symbol;
                loadNews(currentSymbol);
            }
        });

        customSymbolInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchBtn.click();
            }
        });

        // Mobile menu
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const navTabs = document.getElementById('nav-tabs');
        if (mobileMenuBtn && navTabs) {
            mobileMenuBtn.addEventListener('click', () => {
                navTabs.classList.toggle('open');
            });
        }

        // AI Summary button
        const aiSummaryBtn = document.getElementById('ai-summary-btn');
        const closeSummaryBtn = document.getElementById('close-summary-btn');
        const aiSummarySection = document.getElementById('ai-summary-section');

        if (aiSummaryBtn) {
            aiSummaryBtn.addEventListener('click', () => loadAISummary());
        }

        if (closeSummaryBtn && aiSummarySection) {
            closeSummaryBtn.addEventListener('click', () => {
                aiSummarySection.style.display = 'none';
            });
        }

        // Load initial data
        loadNews(currentSymbol);

        console.log('📰 News Feed initialized');
    }

    // ===================================
    // Load AI Summary
    // ===================================
    async function loadAISummary() {
        const aiSummarySection = document.getElementById('ai-summary-section');
        const summaryContent = document.getElementById('summary-content');
        const aiSummaryBtn = document.getElementById('ai-summary-btn');

        // Show loading
        aiSummarySection.style.display = 'block';
        summaryContent.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <span>AI กำลังวิเคราะห์ข่าว...</span>
            </div>
        `;
        aiSummaryBtn.disabled = true;

        try {
            const response = await fetch(`${API_BASE}/api/news/summarize/${currentSymbol}`);

            if (!response.ok) {
                throw new Error('Failed to get AI summary');
            }

            const data = await response.json();
            renderAISummary(data);

        } catch (error) {
            console.error('Error getting AI summary:', error);
            summaryContent.innerHTML = `
                <div class="summary-point">
                    <span class="point-icon">⚠️</span>
                    <span class="point-text">ไม่สามารถสร้างสรุปได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง</span>
                </div>
            `;
        } finally {
            aiSummaryBtn.disabled = false;
        }
    }

    // ===================================
    // Render AI Summary
    // ===================================
    function renderAISummary(data) {
        const summaryContent = document.getElementById('summary-content');

        const sentimentIcon = data.sentiment === 'bullish' ? '📈' :
            data.sentiment === 'bearish' ? '📉' : '➖';
        const sentimentLabel = data.sentiment === 'bullish' ? 'Bullish' :
            data.sentiment === 'bearish' ? 'Bearish' : 'Neutral';
        const sentimentClass = data.sentiment || 'neutral';

        summaryContent.innerHTML = `
            <div class="ai-summary">
                ${data.points?.map((point, index) => `
                    <div class="summary-point">
                        <span class="point-icon">${index + 1}️⃣</span>
                        <span class="point-text">${point}</span>
                    </div>
                `).join('') || '<p>ไม่มีข้อมูลสรุป</p>'}
            </div>
            <div class="summary-sentiment">
                <span class="sentiment-indicator">${sentimentIcon}</span>
                <div class="sentiment-info">
                    <span class="sentiment-label">Overall Sentiment</span>
                    <span class="sentiment-value ${sentimentClass}">${sentimentLabel}</span>
                </div>
            </div>
        `;
    }

    // ===================================
    // Load News
    // ===================================
    async function loadNews(symbol) {
        showLoading();
        newsTitle.textContent = `📋 ข่าว ${symbol}`;

        try {
            const response = await fetch(`${API_BASE}/api/news/${symbol}`);

            if (!response.ok) {
                throw new Error('Failed to fetch news');
            }

            const data = await response.json();
            newsData = data.news || [];

            // Update sentiment counts
            updateSentimentCounts();

            // Update last update time
            lastUpdate.textContent = `อัปเดต: ${new Date().toLocaleTimeString('th-TH')}`;

            renderNews();

        } catch (error) {
            console.error('Error loading news:', error);
            showError('ไม่สามารถโหลดข่าวได้');
        }
    }

    // ===================================
    // Update Sentiment Counts
    // ===================================
    function updateSentimentCounts() {
        const positive = newsData.filter(n => n.sentiment === 'positive').length;
        const neutral = newsData.filter(n => n.sentiment === 'neutral').length;
        const negative = newsData.filter(n => n.sentiment === 'negative').length;

        positiveCount.textContent = positive;
        neutralCount.textContent = neutral;
        negativeCount.textContent = negative;
    }

    // ===================================
    // Render News
    // ===================================
    function renderNews() {
        if (newsData.length === 0) {
            newsGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <p>ไม่พบข่าวสำหรับ ${currentSymbol}</p>
                </div>
            `;
            return;
        }

        newsGrid.innerHTML = newsData.map(news => {
            const timeAgo = getTimeAgo(news.publishedAt);
            const sentimentLabel = getSentimentLabel(news.sentiment);

            return `
                <div class="news-card">
                    <div class="news-thumbnail">
                        ${news.thumbnail
                    ? `<img src="${news.thumbnail}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'news-thumbnail-placeholder\\'>📰</div>'">`
                    : '<div class="news-thumbnail-placeholder">📰</div>'
                }
                    </div>
                    <div class="news-content">
                        <h3 class="news-title">
                            <a href="${news.link}" target="_blank" rel="noopener noreferrer">${news.title}</a>
                        </h3>
                        <div class="news-meta">
                            <span class="news-publisher">${news.publisher || 'Unknown'}</span>
                            <span class="news-time">🕐 ${timeAgo}</span>
                            <span class="sentiment-badge ${news.sentiment}">
                                ${sentimentLabel}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ===================================
    // Helper Functions
    // ===================================
    function getTimeAgo(timestamp) {
        if (!timestamp) return 'Unknown';

        const now = new Date();
        const date = new Date(timestamp * 1000);
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'ตอนนี้';
        if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
        if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
        if (diffDays < 7) return `${diffDays} วันที่แล้ว`;

        return date.toLocaleDateString('th-TH');
    }

    function getSentimentLabel(sentiment) {
        switch (sentiment) {
            case 'positive': return '📈 บวก';
            case 'negative': return '📉 ลบ';
            default: return '➖ กลาง';
        }
    }

    function showLoading() {
        newsGrid.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <span>กำลังโหลดข่าว...</span>
            </div>
        `;
    }

    function showError(message) {
        newsGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <p>${message}</p>
            </div>
        `;
    }

    // ===================================
    // Initialize on DOM Ready
    // ===================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
