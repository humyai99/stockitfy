/**
 * Stock Screener - Frontend Logic
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
    let stocksData = [];
    let filteredData = [];
    let sortColumn = 'change';
    let sortDirection = 'desc';

    // ===================================
    // DOM Elements
    // ===================================
    const resultsTable = document.getElementById('results-tbody');
    const resultsCount = document.getElementById('results-count');
    const lastUpdate = document.getElementById('last-update');
    const applyFiltersBtn = document.getElementById('apply-filters');
    const resetFiltersBtn = document.getElementById('reset-filters');
    const refreshBtn = document.getElementById('refresh-btn');

    // ===================================
    // Initialize
    // ===================================
    function init() {
        // Event listeners
        applyFiltersBtn.addEventListener('click', applyFilters);
        resetFiltersBtn.addEventListener('click', resetFilters);
        refreshBtn.addEventListener('click', loadStocksData);

        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                const min = btn.dataset.min;
                const max = btn.dataset.max;

                const minInput = document.getElementById(`filter-${filter}-min`);
                const maxInput = document.getElementById(`filter-${filter}-max`);

                if (minInput) minInput.value = min || '';
                if (maxInput) maxInput.value = max || '';

                // Toggle active state
                btn.parentElement.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Sortable headers
        document.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const column = th.dataset.sort;
                if (sortColumn === column) {
                    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    sortColumn = column;
                    sortDirection = 'desc';
                }
                updateSortIndicators();
                renderResults();
            });
        });

        // Mobile menu
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const navTabs = document.getElementById('nav-tabs');
        if (mobileMenuBtn && navTabs) {
            mobileMenuBtn.addEventListener('click', () => {
                navTabs.classList.toggle('open');
            });
        }

        // Load initial data
        loadStocksData();

        console.log('📊 Stock Screener initialized');
    }

    // ===================================
    // Load Stocks Data
    // ===================================
    async function loadStocksData() {
        showLoading();

        try {
            const response = await fetch(`${API_BASE}/api/screener`);

            if (!response.ok) {
                throw new Error('Failed to fetch screener data');
            }

            const data = await response.json();
            stocksData = data.stocks || [];
            filteredData = [...stocksData];

            // Update last update time
            lastUpdate.textContent = `อัปเดต: ${new Date().toLocaleTimeString('th-TH')}`;

            renderResults();

        } catch (error) {
            console.error('Error loading stocks:', error);
            showError('ไม่สามารถโหลดข้อมูลได้');
        }
    }

    // ===================================
    // Apply Filters
    // ===================================
    function applyFilters() {
        const filters = {
            changeMin: parseFloat(document.getElementById('filter-change-min').value) || null,
            changeMax: parseFloat(document.getElementById('filter-change-max').value) || null,
            rsiMin: parseFloat(document.getElementById('filter-rsi-min').value) || null,
            rsiMax: parseFloat(document.getElementById('filter-rsi-max').value) || null,
            volumeMin: parseFloat(document.getElementById('filter-volume-min').value) || null,
            volumeMax: parseFloat(document.getElementById('filter-volume-max').value) || null,
            mcapMin: parseFloat(document.getElementById('filter-mcap-min').value) || null,
            mcapMax: parseFloat(document.getElementById('filter-mcap-max').value) || null,
            peMin: parseFloat(document.getElementById('filter-pe-min').value) || null,
            peMax: parseFloat(document.getElementById('filter-pe-max').value) || null,
            aiMin: parseFloat(document.getElementById('filter-ai-min').value) || null,
            aiMax: parseFloat(document.getElementById('filter-ai-max').value) || null,
        };

        filteredData = stocksData.filter(stock => {
            // Change filter
            if (filters.changeMin !== null && stock.changePercent < filters.changeMin) return false;
            if (filters.changeMax !== null && stock.changePercent > filters.changeMax) return false;

            // RSI filter
            if (filters.rsiMin !== null && stock.rsi < filters.rsiMin) return false;
            if (filters.rsiMax !== null && stock.rsi > filters.rsiMax) return false;

            // Volume filter (in millions)
            const volumeM = stock.volume / 1e6;
            if (filters.volumeMin !== null && volumeM < filters.volumeMin) return false;
            if (filters.volumeMax !== null && volumeM > filters.volumeMax) return false;

            // Market Cap filter (in billions)
            const mcapB = stock.marketCap / 1e9;
            if (filters.mcapMin !== null && mcapB < filters.mcapMin) return false;
            if (filters.mcapMax !== null && mcapB > filters.mcapMax) return false;

            // P/E filter
            if (filters.peMin !== null && (stock.pe === null || stock.pe < filters.peMin)) return false;
            if (filters.peMax !== null && stock.pe !== null && stock.pe > filters.peMax) return false;

            // AI Score filter
            if (filters.aiMin !== null && stock.aiScore < filters.aiMin) return false;
            if (filters.aiMax !== null && stock.aiScore > filters.aiMax) return false;

            return true;
        });

        renderResults();
    }

    // ===================================
    // Reset Filters
    // ===================================
    function resetFilters() {
        // Clear all inputs
        document.querySelectorAll('.filter-card input').forEach(input => {
            input.value = '';
        });

        // Remove active from presets
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Reset filtered data
        filteredData = [...stocksData];
        renderResults();
    }

    // ===================================
    // Render Results
    // ===================================
    function renderResults() {
        // Sort data
        const sorted = [...filteredData].sort((a, b) => {
            let aVal = a[sortColumn];
            let bVal = b[sortColumn];

            // Handle nulls
            if (aVal === null) aVal = sortDirection === 'asc' ? Infinity : -Infinity;
            if (bVal === null) bVal = sortDirection === 'asc' ? Infinity : -Infinity;

            // String comparison for symbol/name
            if (typeof aVal === 'string') {
                return sortDirection === 'asc'
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }

            // Numeric comparison
            return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        });

        // Update count
        resultsCount.textContent = `${sorted.length} หุ้น`;

        // Render rows
        if (sorted.length === 0) {
            resultsTable.innerHTML = `
                <tr class="empty-state">
                    <td colspan="10">
                        <div class="empty-state-icon">📭</div>
                        <p>ไม่พบหุ้นที่ตรงตามเงื่อนไข</p>
                    </td>
                </tr>
            `;
            return;
        }

        resultsTable.innerHTML = sorted.map(stock => {
            const changeClass = stock.changePercent >= 0 ? 'positive' : 'negative';
            const changeSign = stock.changePercent >= 0 ? '+' : '';
            const rsiClass = stock.rsi < 30 ? 'oversold' : stock.rsi > 70 ? 'overbought' : '';
            const aiScoreClass = getAiScoreClass(stock.aiScore);

            return `
                <tr>
                    <td class="symbol-cell">${stock.symbol}</td>
                    <td class="name-cell" title="${stock.name}">${stock.name}</td>
                    <td class="price-cell">$${stock.price.toFixed(2)}</td>
                    <td class="change-cell ${changeClass}">${changeSign}${stock.changePercent.toFixed(2)}%</td>
                    <td class="rsi-cell ${rsiClass}">${stock.rsi?.toFixed(1) || 'N/A'}</td>
                    <td class="volume-cell">${formatVolume(stock.volume)}</td>
                    <td class="mcap-cell">${formatMarketCap(stock.marketCap)}</td>
                    <td class="pe-cell">${stock.pe?.toFixed(1) || 'N/A'}</td>
                    <td><span class="ai-score-badge ${aiScoreClass}">${stock.aiScore}</span></td>
                    <td><a href="analyzer.html?symbol=${stock.symbol}" class="analyze-btn">วิเคราะห์</a></td>
                </tr>
            `;
        }).join('');
    }

    // ===================================
    // Helper Functions
    // ===================================
    function updateSortIndicators() {
        document.querySelectorAll('.sortable').forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
            if (th.dataset.sort === sortColumn) {
                th.classList.add(sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
            }
        });
    }

    function getAiScoreClass(score) {
        if (score >= 70) return 'strong-buy';
        if (score >= 55) return 'buy';
        if (score >= 40) return 'hold';
        return 'sell';
    }

    function formatVolume(volume) {
        if (volume >= 1e9) return (volume / 1e9).toFixed(2) + 'B';
        if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M';
        if (volume >= 1e3) return (volume / 1e3).toFixed(1) + 'K';
        return volume.toString();
    }

    function formatMarketCap(cap) {
        if (!cap) return 'N/A';
        if (cap >= 1e12) return '$' + (cap / 1e12).toFixed(2) + 'T';
        if (cap >= 1e9) return '$' + (cap / 1e9).toFixed(1) + 'B';
        if (cap >= 1e6) return '$' + (cap / 1e6).toFixed(1) + 'M';
        return '$' + cap.toLocaleString();
    }

    function showLoading() {
        resultsTable.innerHTML = `
            <tr class="loading-row">
                <td colspan="10">
                    <div class="loading-spinner"></div>
                    <span>กำลังโหลดข้อมูล...</span>
                </td>
            </tr>
        `;
    }

    function showError(message) {
        resultsTable.innerHTML = `
            <tr class="empty-state">
                <td colspan="10">
                    <div class="empty-state-icon">❌</div>
                    <p>${message}</p>
                </td>
            </tr>
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
