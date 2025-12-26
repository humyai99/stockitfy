/**
 * Top Movers Dashboard
 * Real-time top gainers, losers, and most active stocks
 */

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : `http://${window.location.hostname}:3001`;

// State
let currentTab = 'gainers';
let moversData = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏆 Top Movers Dashboard initialized');

    loadTopMovers();

    // Refresh button
    document.getElementById('refresh-btn')?.addEventListener('click', loadTopMovers);

    // Mobile menu
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
        document.getElementById('nav-tabs')?.classList.toggle('open');
    });

    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            renderMovers();
        });
    });

    // Auto refresh every 30 seconds
    setInterval(loadTopMovers, 30000);
});

// Load top movers data
async function loadTopMovers() {
    const grid = document.getElementById('movers-grid');
    grid.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <span>กำลังโหลดข้อมูล...</span>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE}/api/top-movers`);

        if (!response.ok) {
            throw new Error('Failed to fetch');
        }

        const data = await response.json();
        moversData = data;

        updateSummary(data);
        renderMovers();
        updateLastUpdate();

    } catch (error) {
        console.error('Error loading top movers:', error);
        grid.innerHTML = `
            <div class="loading-state">
                <span style="font-size: 2rem;">⚠️</span>
                <span>ไม่สามารถโหลดข้อมูลได้</span>
            </div>
        `;
    }
}

// Update summary cards
function updateSummary(data) {
    document.getElementById('gainers-count').textContent = data.gainers?.length || 0;
    document.getElementById('losers-count').textContent = data.losers?.length || 0;

    // Check if market is open (US Eastern time 9:30 AM - 4:00 PM)
    const now = new Date();
    const utcHours = now.getUTCHours();
    const isWeekday = now.getUTCDay() > 0 && now.getUTCDay() < 6;
    const isMarketHours = utcHours >= 14 && utcHours < 21; // 9:30 AM - 4:00 PM EST in UTC

    const statusText = document.getElementById('market-status-text');
    if (isWeekday && isMarketHours) {
        statusText.textContent = '🟢 Open';
        statusText.style.color = 'var(--positive)';
    } else {
        statusText.textContent = '🔴 Closed';
        statusText.style.color = 'var(--negative)';
    }
}

// Render movers based on current tab
function renderMovers() {
    const grid = document.getElementById('movers-grid');

    if (!moversData) {
        return;
    }

    let stocks = [];
    let cardClass = 'gainer';

    switch (currentTab) {
        case 'gainers':
            stocks = moversData.gainers || [];
            cardClass = 'gainer';
            break;
        case 'losers':
            stocks = moversData.losers || [];
            cardClass = 'loser';
            break;
        case 'active':
            stocks = moversData.mostActive || [];
            cardClass = 'active';
            break;
    }

    if (stocks.length === 0) {
        grid.innerHTML = `
            <div class="loading-state">
                <span style="font-size: 2rem;">📭</span>
                <span>ไม่พบข้อมูล</span>
            </div>
        `;
        return;
    }

    grid.innerHTML = stocks.map((stock, index) => createMoverCard(stock, index + 1, cardClass)).join('');
}

// Create mover card HTML
function createMoverCard(stock, rank, type) {
    const isPositive = stock.change >= 0;
    const changeSign = isPositive ? '+' : '';
    const cardClass = type === 'active' ? (isPositive ? 'gainer' : 'loser') : type;

    return `
        <div class="mover-card ${cardClass}">
            <div class="mover-rank">
                <span class="rank-number">${rank}</span>
                <div>
                    <div class="mover-symbol">${stock.symbol}</div>
                    <div class="mover-name">${stock.name || '-'}</div>
                </div>
            </div>
            <div class="mover-price-row">
                <div class="mover-price">$${stock.price?.toFixed(2) || '-'}</div>
                <div class="mover-change">
                    <span class="change-value">${changeSign}${stock.change?.toFixed(2) || '-'}</span>
                    <span class="change-percent">${changeSign}${stock.changePercent?.toFixed(2)}%</span>
                </div>
            </div>
            <div class="mover-volume">
                <span>Volume</span>
                <span class="volume-value">${formatVolume(stock.volume)}</span>
            </div>
        </div>
    `;
}

// Format volume
function formatVolume(volume) {
    if (!volume) return '-';
    if (volume >= 1e9) return (volume / 1e9).toFixed(2) + 'B';
    if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M';
    if (volume >= 1e3) return (volume / 1e3).toFixed(2) + 'K';
    return volume.toString();
}

// Update last update time
function updateLastUpdate() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('last-update').textContent = `อัปเดต: ${timeStr}`;
}
