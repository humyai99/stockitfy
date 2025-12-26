/**
 * Global Markets Dashboard
 * Real-time global stock indices tracking
 */

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : `http://${window.location.hostname}:3001`;

// Global indices configuration
const INDICES = {
    americas: [
        { symbol: '^GSPC', name: 'S&P 500', flag: '🇺🇸', country: 'USA' },
        { symbol: '^DJI', name: 'Dow Jones', flag: '🇺🇸', country: 'USA' },
        { symbol: '^IXIC', name: 'NASDAQ', flag: '🇺🇸', country: 'USA' },
        { symbol: '^RUT', name: 'Russell 2000', flag: '🇺🇸', country: 'USA' },
        { symbol: '^GSPTSE', name: 'TSX Composite', flag: '🇨🇦', country: 'Canada' },
        { symbol: '^BVSP', name: 'Bovespa', flag: '🇧🇷', country: 'Brazil' }
    ],
    europe: [
        { symbol: '^FTSE', name: 'FTSE 100', flag: '🇬🇧', country: 'UK' },
        { symbol: '^GDAXI', name: 'DAX', flag: '🇩🇪', country: 'Germany' },
        { symbol: '^FCHI', name: 'CAC 40', flag: '🇫🇷', country: 'France' },
        { symbol: '^STOXX50E', name: 'Euro Stoxx 50', flag: '🇪🇺', country: 'Europe' },
        { symbol: '^AEX', name: 'AEX', flag: '🇳🇱', country: 'Netherlands' },
        { symbol: 'FTSEMIB.MI', name: 'FTSE MIB', flag: '🇮🇹', country: 'Italy' }
    ],
    asia: [
        { symbol: '^N225', name: 'Nikkei 225', flag: '🇯🇵', country: 'Japan' },
        { symbol: '^HSI', name: 'Hang Seng', flag: '🇭🇰', country: 'Hong Kong' },
        { symbol: '000001.SS', name: 'Shanghai', flag: '🇨🇳', country: 'China' },
        { symbol: '^KS11', name: 'KOSPI', flag: '🇰🇷', country: 'Korea' },
        { symbol: '^TWII', name: 'TAIEX', flag: '🇹🇼', country: 'Taiwan' },
        { symbol: '^SET.BK', name: 'SET Index', flag: '🇹🇭', country: 'Thailand' },
        { symbol: '^AXJO', name: 'ASX 200', flag: '🇦🇺', country: 'Australia' },
        { symbol: '^BSESN', name: 'SENSEX', flag: '🇮🇳', country: 'India' }
    ]
};

let globalData = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌍 Global Markets Dashboard initialized');
    loadGlobalMarkets();
    updateUTCTime();
    setInterval(updateUTCTime, 1000);

    // Refresh button
    document.getElementById('refresh-btn')?.addEventListener('click', () => {
        loadGlobalMarkets();
    });

    // Mobile menu
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
        document.getElementById('nav-tabs')?.classList.toggle('open');
    });

    // Auto refresh every 60 seconds
    setInterval(loadGlobalMarkets, 60000);
});

// Load global markets data
async function loadGlobalMarkets() {
    try {
        const response = await fetch(`${API_BASE}/api/global-markets`);

        if (!response.ok) {
            throw new Error('Failed to fetch global markets data');
        }

        const data = await response.json();
        globalData = data;

        renderRegion('americas', data.americas);
        renderRegion('europe', data.europe);
        renderRegion('asia', data.asia);
        updateSummary(data);
        updateLastUpdate();

    } catch (error) {
        console.error('Error loading global markets:', error);
        // Show error state or use fallback data
        showErrorState();
    }
}

// Render region indices
function renderRegion(regionId, indices) {
    const grid = document.getElementById(`${regionId}-grid`);
    if (!grid || !indices) return;

    grid.innerHTML = indices.map(index => createIndexCard(index)).join('');
}

// Create index card HTML
function createIndexCard(data) {
    const isPositive = data.change >= 0;
    const changeSign = isPositive ? '+' : '';
    const cardClass = isPositive ? 'positive' : 'negative';

    return `
        <div class="index-card ${cardClass}">
            <div class="index-header">
                <div class="index-info">
                    <span class="index-flag">${data.flag}</span>
                    <div>
                        <div class="index-name">${data.name}</div>
                        <div class="index-symbol">${data.symbol}</div>
                    </div>
                </div>
                <div class="index-time">${data.country}</div>
            </div>
            <div class="index-price-row">
                <div class="index-price">${formatNumber(data.price)}</div>
                <div class="index-change">
                    <span class="change-value">${changeSign}${formatNumber(data.change)}</span>
                    <span class="change-percent">${changeSign}${data.changePercent?.toFixed(2)}%</span>
                </div>
            </div>
        </div>
    `;
}

// Update summary cards
function updateSummary(data) {
    const allIndices = [...(data.americas || []), ...(data.europe || []), ...(data.asia || [])];
    const marketsUp = allIndices.filter(i => i.change >= 0).length;
    const marketsDown = allIndices.filter(i => i.change < 0).length;

    document.getElementById('markets-up').textContent = marketsUp;
    document.getElementById('markets-down').textContent = marketsDown;
}

// Update UTC time
function updateUTCTime() {
    const now = new Date();
    const utcTime = now.toUTCString().split(' ')[4];
    document.getElementById('utc-time').textContent = utcTime;
}

// Update last update time
function updateLastUpdate() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('last-update').textContent = `อัปเดต: ${timeStr}`;
}

// Format number with commas
function formatNumber(num) {
    if (num === undefined || num === null) return '-';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Show error state
function showErrorState() {
    const grids = ['americas-grid', 'europe-grid', 'asia-grid'];
    grids.forEach(id => {
        const grid = document.getElementById(id);
        if (grid) {
            grid.innerHTML = `
                <div class="loading-state" style="grid-column: 1/-1;">
                    <span style="font-size: 2rem;">⚠️</span>
                    <span>ไม่สามารถโหลดข้อมูลได้</span>
                </div>
            `;
        }
    });
}
