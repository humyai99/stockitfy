/**
 * Dividend Calendar - JavaScript
 */

// API Configuration
const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : '';

// State
let dividendsData = [];
let sortBy = 'date';

// DOM Elements
const dividendGrid = document.getElementById('dividend-grid');
const refreshBtn = document.getElementById('refresh-btn');
const sortSelect = document.getElementById('sort-select');
const totalStocksEl = document.getElementById('total-stocks');
const avgYieldEl = document.getElementById('avg-yield');
const upcomingCountEl = document.getElementById('upcoming-count');
const lastUpdateEl = document.getElementById('last-update');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('💰 Dividend Calendar initialized');
    loadDividends();
    setupEventListeners();
});

function setupEventListeners() {
    refreshBtn?.addEventListener('click', loadDividends);
    sortSelect?.addEventListener('change', (e) => {
        sortBy = e.target.value;
        renderDividends();
    });

    // Mobile menu
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navTabs = document.getElementById('nav-tabs');
    mobileMenuBtn?.addEventListener('click', () => {
        navTabs?.classList.toggle('open');
    });
}

async function loadDividends() {
    try {
        showLoading();

        const response = await fetch(`${API_BASE}/api/dividends`);
        if (!response.ok) throw new Error('Failed to fetch dividends');

        const data = await response.json();
        dividendsData = data.dividends || [];

        updateStats();
        renderDividends();
        updateLastUpdate();

    } catch (error) {
        console.error('Error loading dividends:', error);
        showError();
    }
}

function updateStats() {
    totalStocksEl.textContent = dividendsData.length;

    const avgYield = dividendsData.length > 0
        ? dividendsData.reduce((sum, d) => sum + d.dividendYield, 0) / dividendsData.length
        : 0;
    avgYieldEl.textContent = avgYield.toFixed(2) + '%';

    const upcoming = dividendsData.filter(d => d.daysUntilEx && d.daysUntilEx > 0 && d.daysUntilEx <= 30).length;
    upcomingCountEl.textContent = upcoming;
}

function renderDividends() {
    if (dividendsData.length === 0) {
        dividendGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <p>ไม่พบข้อมูลปันผล</p>
            </div>
        `;
        return;
    }

    // Sort data
    const sorted = [...dividendsData].sort((a, b) => {
        if (sortBy === 'yield') {
            return b.dividendYield - a.dividendYield;
        } else if (sortBy === 'symbol') {
            return a.symbol.localeCompare(b.symbol);
        } else {
            // Sort by date
            if (!a.exDividendDate) return 1;
            if (!b.exDividendDate) return -1;
            return new Date(a.exDividendDate) - new Date(b.exDividendDate);
        }
    });

    dividendGrid.innerHTML = sorted.map(div => createDividendCard(div)).join('');
}

function createDividendCard(div) {
    const exDate = div.exDividendDate ? new Date(div.exDividendDate) : null;
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    let dateHtml = '';
    if (exDate) {
        dateHtml = `
            <div class="dividend-date">
                <span class="month">${monthNames[exDate.getMonth()]}</span>
                <span class="day">${exDate.getDate()}</span>
                <span class="year">${exDate.getFullYear()}</span>
            </div>
        `;
    } else {
        dateHtml = `
            <div class="dividend-date">
                <span class="month">-</span>
                <span class="day">TBD</span>
                <span class="year">-</span>
            </div>
        `;
    }

    // Countdown
    let countdownClass = '';
    let countdownText = '-';
    if (div.daysUntilEx !== null) {
        if (div.daysUntilEx === 0) {
            countdownText = 'วันนี้';
            countdownClass = 'today';
        } else if (div.daysUntilEx < 0) {
            countdownText = 'ผ่านแล้ว';
            countdownClass = 'passed';
        } else if (div.daysUntilEx <= 7) {
            countdownText = `${div.daysUntilEx} วัน`;
            countdownClass = 'soon';
        } else {
            countdownText = `${div.daysUntilEx} วัน`;
        }
    }

    return `
        <div class="dividend-card">
            ${dateHtml}
            <div class="dividend-info">
                <span class="dividend-symbol">${div.symbol}</span>
                <span class="dividend-name">${div.name}</span>
                <div class="dividend-meta">
                    <span>💵 $${div.dividendRate.toFixed(2)}/หุ้น</span>
                    <span>📊 ราคา $${div.price.toFixed(2)}</span>
                    <span>📅 ${div.frequency}</span>
                </div>
            </div>
            <div class="dividend-yield">
                <span class="yield-value">${div.dividendYield.toFixed(2)}%</span>
                <span class="yield-label">Yield</span>
            </div>
            <div class="dividend-countdown">
                <span class="countdown-value ${countdownClass}">${countdownText}</span>
                <span class="countdown-label">Ex-Div</span>
            </div>
        </div>
    `;
}

function showLoading() {
    dividendGrid.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <span>กำลังโหลดข้อมูลปันผล...</span>
        </div>
    `;
}

function showError() {
    dividendGrid.innerHTML = `
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
