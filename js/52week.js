/**
 * 52-Week High/Low - JavaScript
 */

// API Configuration
const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : '';

// State
let weekData = null;
let currentTab = 'highs';

// DOM Elements
const stocksGrid = document.getElementById('stocks-grid');
const refreshBtn = document.getElementById('refresh-btn');
const lastUpdateEl = document.getElementById('last-update');
const newHighsEl = document.getElementById('new-highs');
const nearHighsEl = document.getElementById('near-highs');
const nearLowsEl = document.getElementById('near-lows');
const newLowsEl = document.getElementById('new-lows');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('📈📉 52-Week High/Low initialized');
    load52WeekData();
    setupEventListeners();
});

function setupEventListeners() {
    refreshBtn?.addEventListener('click', load52WeekData);

    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentTab = e.target.dataset.tab;
            renderStocks();
        });
    });

    // Mobile menu
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navTabs = document.getElementById('nav-tabs');
    mobileMenuBtn?.addEventListener('click', () => {
        navTabs?.classList.toggle('open');
    });
}

async function load52WeekData() {
    try {
        showLoading();

        const response = await fetch(`${API_BASE}/api/52week`);
        if (!response.ok) throw new Error('Failed to fetch 52-week data');

        weekData = await response.json();

        updateStats();
        renderStocks();
        updateLastUpdate();

    } catch (error) {
        console.error('Error loading 52-week data:', error);
        showError();
    }
}

function updateStats() {
    if (!weekData || !weekData.summary) return;

    newHighsEl.textContent = weekData.summary.totalNewHighs || 0;
    nearHighsEl.textContent = weekData.summary.totalNearHighs || 0;
    nearLowsEl.textContent = weekData.summary.totalNearLows || 0;
    newLowsEl.textContent = weekData.summary.totalNewLows || 0;
}

function renderStocks() {
    if (!weekData) {
        showError();
        return;
    }

    let stocks = [];
    let isBullish = true;

    switch (currentTab) {
        case 'highs':
            stocks = weekData.nearHighs || [];
            isBullish = true;
            break;
        case 'lows':
            stocks = weekData.nearLows || [];
            isBullish = false;
            break;
        case 'new-highs':
            stocks = weekData.newHighs || [];
            isBullish = true;
            break;
        case 'new-lows':
            stocks = weekData.newLows || [];
            isBullish = false;
            break;
    }

    if (stocks.length === 0) {
        stocksGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${isBullish ? '📈' : '📉'}</div>
                <p>ไม่พบหุ้นในหมวดหมู่นี้</p>
            </div>
        `;
        return;
    }

    stocksGrid.innerHTML = stocks.map(stock => createStockCard(stock, isBullish)).join('');
}

function createStockCard(stock, isBullish) {
    const changeClass = stock.changePercent >= 0 ? 'positive' : 'negative';
    const changeSign = stock.changePercent >= 0 ? '+' : '';

    // Calculate range position (0 = low, 100 = high)
    const range = stock.high52 - stock.low52;
    const position = range > 0 ? ((stock.price - stock.low52) / range) * 100 : 50;

    const distanceValue = isBullish ? stock.distFromHigh : stock.distFromLow;
    const distanceLabel = isBullish ? 'From High' : 'From Low';
    const distanceClass = isBullish ? 'near-high' : 'near-low';

    return `
        <div class="stock-card ${isBullish ? 'bullish' : 'bearish'}">
            <div class="stock-symbol">
                <span class="symbol">${stock.symbol}</span>
                <span class="name">${stock.name}</span>
            </div>
            <div class="stock-price">
                <span class="current-price">$${stock.price.toFixed(2)}</span>
                <span class="price-change ${changeClass}">${changeSign}${stock.changePercent.toFixed(2)}%</span>
            </div>
            <div class="stock-range">
                <div class="range-bar">
                    <div class="range-fill" style="width: 100%"></div>
                    <div class="range-marker" style="left: ${position}%"></div>
                </div>
                <div class="range-labels">
                    <span>$${stock.low52.toFixed(0)}</span>
                    <span>$${stock.high52.toFixed(0)}</span>
                </div>
            </div>
            <div class="stock-distance">
                <span class="distance-value ${distanceClass}">${distanceValue}%</span>
                <span class="distance-label">${distanceLabel}</span>
            </div>
        </div>
    `;
}

function showLoading() {
    stocksGrid.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <span>กำลังโหลดข้อมูล 52-Week...</span>
        </div>
    `;
}

function showError() {
    stocksGrid.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">❌</div>
            <p>เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง</p>
        </div>
    `;
}

function updateLastUpdate() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    lastUpdateEl.textContent = `อัปเดต: ${timeStr}`;
}
