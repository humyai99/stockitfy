/**
 * Technical Screener
 * Filter stocks by technical indicators
 */

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : `http://${window.location.hostname}:3001`;

// State
let filters = {
    rsi: [],
    macd: [],
    ma: [],
    volume: []
};

// Presets
const PRESETS = {
    bullish: {
        rsi: ['neutral'],
        macd: ['bullish'],
        ma: ['above_sma50', 'above_sma200'],
        volume: []
    },
    bearish: {
        rsi: ['overbought'],
        macd: ['bearish'],
        ma: [],
        volume: []
    },
    oversold: {
        rsi: ['oversold'],
        macd: [],
        ma: [],
        volume: ['high']
    },
    breakout: {
        rsi: [],
        macd: ['crossover'],
        ma: ['above_sma50'],
        volume: ['high']
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('📊 Technical Screener initialized');

    // Scan button
    document.getElementById('scan-btn')?.addEventListener('click', scanStocks);

    // Reset button
    document.getElementById('reset-btn')?.addEventListener('click', resetFilters);

    // Mobile menu
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
        document.getElementById('nav-tabs')?.classList.toggle('open');
    });

    // Filter checkboxes
    document.querySelectorAll('.filter-option input').forEach(input => {
        input.addEventListener('change', updateFilters);
    });

    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
    });

    // Sort select
    document.getElementById('sort-select')?.addEventListener('change', sortResults);
});

// Update filters from checkboxes
function updateFilters() {
    filters = {
        rsi: getCheckedValues('rsi'),
        macd: getCheckedValues('macd'),
        ma: getCheckedValues('ma'),
        volume: getCheckedValues('volume')
    };
}

// Get checked values for a filter group
function getCheckedValues(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
        .map(input => input.value);
}

// Apply preset
function applyPreset(presetName) {
    const preset = PRESETS[presetName];
    if (!preset) return;

    // Clear all checkboxes
    document.querySelectorAll('.filter-option input').forEach(input => {
        input.checked = false;
    });

    // Apply preset
    Object.entries(preset).forEach(([filterName, values]) => {
        values.forEach(value => {
            const input = document.querySelector(`input[name="${filterName}"][value="${value}"]`);
            if (input) input.checked = true;
        });
    });

    updateFilters();
    scanStocks();
}

// Reset filters
function resetFilters() {
    document.querySelectorAll('.filter-option input').forEach(input => {
        input.checked = false;
    });
    filters = { rsi: [], macd: [], ma: [], volume: [] };

    document.getElementById('results-grid').innerHTML = `
        <div class="empty-state">
            <span class="empty-icon">🔍</span>
            <p>เลือก Filter แล้วกด "Scan หุ้น" เพื่อค้นหา</p>
        </div>
    `;
    document.getElementById('result-count').textContent = '(0)';
}

// Scan stocks
async function scanStocks() {
    updateFilters();

    const grid = document.getElementById('results-grid');
    grid.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <span>กำลัง Scan หุ้น...</span>
        </div>
    `;

    try {
        const params = new URLSearchParams();
        if (filters.rsi.length) params.append('rsi', filters.rsi.join(','));
        if (filters.macd.length) params.append('macd', filters.macd.join(','));
        if (filters.ma.length) params.append('ma', filters.ma.join(','));
        if (filters.volume.length) params.append('volume', filters.volume.join(','));

        const response = await fetch(`${API_BASE}/api/technical-screener?${params}`);

        if (!response.ok) {
            throw new Error('Failed to fetch');
        }

        const data = await response.json();
        renderResults(data.results || []);
        updateLastUpdate();

    } catch (error) {
        console.error('Error scanning stocks:', error);
        grid.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">⚠️</span>
                <p>เกิดข้อผิดพลาดในการ Scan หุ้น</p>
            </div>
        `;
    }
}

// Render results
function renderResults(results) {
    const grid = document.getElementById('results-grid');
    document.getElementById('result-count').textContent = `(${results.length})`;

    if (results.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📭</span>
                <p>ไม่พบหุ้นที่ตรงตามเงื่อนไข</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = results.map(stock => createResultCard(stock)).join('');
}

// Create result card HTML
function createResultCard(stock) {
    const isPositive = stock.change >= 0;
    const changeSign = isPositive ? '+' : '';
    const cardClass = isPositive ? 'bullish' : 'bearish';
    const changeClass = isPositive ? 'positive' : 'negative';

    // Determine RSI status
    let rsiClass = 'neutral';
    if (stock.rsi < 30) rsiClass = 'bullish';
    else if (stock.rsi > 70) rsiClass = 'bearish';

    // Determine MACD status
    const macdClass = stock.macdSignal === 'bullish' ? 'bullish' :
        stock.macdSignal === 'bearish' ? 'bearish' : 'neutral';

    return `
        <div class="stock-result-card ${cardClass}">
            <div class="stock-header">
                <div>
                    <div class="stock-symbol">${stock.symbol}</div>
                    <div class="stock-name">${stock.name || '-'}</div>
                </div>
                <div class="stock-price-info">
                    <div class="stock-price">$${stock.price?.toFixed(2) || '-'}</div>
                    <span class="stock-change ${changeClass}">${changeSign}${stock.changePercent?.toFixed(2)}%</span>
                </div>
            </div>
            <div class="indicators-grid">
                <div class="indicator-item">
                    <span class="indicator-label">RSI (14)</span>
                    <span class="indicator-value ${rsiClass}">${stock.rsi?.toFixed(1) || '-'}</span>
                </div>
                <div class="indicator-item">
                    <span class="indicator-label">MACD</span>
                    <span class="indicator-value ${macdClass}">${stock.macdSignal || '-'}</span>
                </div>
                <div class="indicator-item">
                    <span class="indicator-label">SMA 50</span>
                    <span class="indicator-value">${stock.sma50?.toFixed(2) || '-'}</span>
                </div>
                <div class="indicator-item">
                    <span class="indicator-label">SMA 200</span>
                    <span class="indicator-value">${stock.sma200?.toFixed(2) || '-'}</span>
                </div>
            </div>
            ${stock.signals?.length ? `
                <div class="signal-badge ${cardClass}">
                    ⚡ ${stock.signals.join(', ')}
                </div>
            ` : ''}
        </div>
    `;
}

// Sort results
function sortResults() {
    // Re-fetch with sort parameter
    // For now, just re-scan
    scanStocks();
}

// Update last update time
function updateLastUpdate() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('last-update').textContent = `อัปเดต: ${timeStr}`;
}
