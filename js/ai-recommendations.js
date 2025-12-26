/**
 * AI Stock Recommendations
 * AI-powered stock analysis and recommendations
 */

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : `http://${window.location.hostname}:3001`;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('🤖 AI Recommendations initialized');

    loadRecommendations();

    // Refresh button
    document.getElementById('refresh-btn')?.addEventListener('click', loadRecommendations);

    // Mobile menu
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
        document.getElementById('nav-tabs')?.classList.toggle('open');
    });
});

// Load AI recommendations
async function loadRecommendations() {
    const grid = document.getElementById('picks-grid');
    grid.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <span>AI กำลังวิเคราะห์หุ้น...</span>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE}/api/ai-recommendations`);

        if (!response.ok) {
            throw new Error('Failed to fetch');
        }

        const data = await response.json();

        document.getElementById('picks-count').textContent = `${data.picks?.length || 0} หุ้น`;
        renderPicks(data.picks || []);
        updateLastUpdate();

    } catch (error) {
        console.error('Error loading AI recommendations:', error);
        grid.innerHTML = `
            <div class="loading-state">
                <span style="font-size: 2rem;">⚠️</span>
                <span>ไม่สามารถโหลดข้อมูลได้</span>
            </div>
        `;
    }
}

// Render picks
function renderPicks(picks) {
    const grid = document.getElementById('picks-grid');

    if (picks.length === 0) {
        grid.innerHTML = `
            <div class="loading-state">
                <span style="font-size: 2rem;">📭</span>
                <span>ไม่พบหุ้นที่ตรงเงื่อนไข AI วันนี้</span>
            </div>
        `;
        return;
    }

    grid.innerHTML = picks.map((pick, index) => createPickCard(pick, index + 1)).join('');
}

// Create pick card HTML
function createPickCard(pick, rank) {
    const isPositive = pick.change >= 0;
    const changeSign = isPositive ? '+' : '';
    const changeClass = isPositive ? 'positive' : 'negative';

    // Determine card class based on confidence
    const cardClass = pick.confidence >= 80 ? 'strong-buy' :
        pick.confidence >= 60 ? 'buy' : 'hold';

    // Determine RSI class
    const rsiClass = pick.rsi < 30 ? 'positive' :
        pick.rsi > 70 ? 'negative' : 'neutral';

    return `
        <div class="pick-card ${cardClass}">
            <div class="pick-header">
                <div class="pick-info">
                    <span class="pick-rank">#${rank}</span>
                    <div>
                        <div class="pick-symbol">${pick.symbol}</div>
                        <div class="pick-name">${pick.name || '-'}</div>
                    </div>
                </div>
                <span class="confidence-badge ${pick.confidence >= 70 ? 'high' : 'medium'}">
                    ${pick.confidence}% Confidence
                </span>
            </div>
            
            <div class="pick-metrics">
                <div class="metric-item">
                    <span class="metric-label">Price</span>
                    <span class="metric-value">$${pick.price?.toFixed(2) || '-'}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Change</span>
                    <span class="metric-value ${changeClass}">${changeSign}${pick.changePercent?.toFixed(2)}%</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">RSI (14)</span>
                    <span class="metric-value ${rsiClass}">${pick.rsi?.toFixed(1) || '-'}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">MACD Signal</span>
                    <span class="metric-value ${pick.macdSignal === 'bullish' ? 'positive' : 'negative'}">${pick.macdSignal || '-'}</span>
                </div>
            </div>
            
            <div class="pick-reason">
                <div class="reason-title">🤖 AI Analysis</div>
                <div class="reason-text">${pick.reason || 'ไม่มีข้อมูล'}</div>
            </div>
        </div>
    `;
}

// Update last update time
function updateLastUpdate() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('last-update').textContent = `อัปเดต: ${timeStr}`;
}
