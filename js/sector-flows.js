/**
 * Sector ETF Flows - JavaScript
 */

// API Configuration
const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : '';

// State
let sectorsData = [];

// DOM Elements
const heatmapGrid = document.getElementById('heatmap-grid');
const sectorTbody = document.getElementById('sector-tbody');
const refreshBtn = document.getElementById('refresh-btn');
const lastUpdateEl = document.getElementById('last-update');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('📊 Sector ETF Flows initialized');
    loadSectorFlows();
    setupEventListeners();
});

function setupEventListeners() {
    refreshBtn?.addEventListener('click', loadSectorFlows);

    // Mobile menu
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navTabs = document.getElementById('nav-tabs');
    mobileMenuBtn?.addEventListener('click', () => {
        navTabs?.classList.toggle('open');
    });
}

async function loadSectorFlows() {
    try {
        showLoading();

        const response = await fetch(`${API_BASE}/api/sector-flows`);
        if (!response.ok) throw new Error('Failed to fetch sector flows');

        const data = await response.json();
        sectorsData = data.sectors || [];

        renderHeatmap();
        renderTable();
        updateLastUpdate();

    } catch (error) {
        console.error('Error loading sector flows:', error);
        showError();
    }
}

function getTileClass(changePercent) {
    if (changePercent >= 2) return 'positive-strong';
    if (changePercent >= 1) return 'positive-medium';
    if (changePercent >= 0.3) return 'positive-weak';
    if (changePercent <= -2) return 'negative-strong';
    if (changePercent <= -1) return 'negative-medium';
    if (changePercent <= -0.3) return 'negative-weak';
    return 'neutral';
}

function renderHeatmap() {
    if (sectorsData.length === 0) {
        heatmapGrid.innerHTML = `
            <div class="loading-state">
                <span>ไม่พบข้อมูล</span>
            </div>
        `;
        return;
    }

    heatmapGrid.innerHTML = sectorsData.map(sector => {
        const tileClass = getTileClass(sector.changePercent);
        const changeSign = sector.changePercent >= 0 ? '+' : '';

        return `
            <div class="sector-tile ${tileClass}">
                <div class="tile-icon">${sector.icon}</div>
                <span class="tile-name">${sector.name}</span>
                <span class="tile-symbol">${sector.symbol}</span>
                <span class="tile-change">${changeSign}${sector.changePercent.toFixed(2)}%</span>
                <span class="tile-volume">Vol: ${sector.volumeRatio}%</span>
                <span class="flow-badge ${sector.flowSignal}">${getFlowLabel(sector.flowSignal)}</span>
            </div>
        `;
    }).join('');
}

function getFlowLabel(signal) {
    switch (signal) {
        case 'inflow': return '🟢 Inflow';
        case 'outflow': return '🔴 Outflow';
        default: return '⚪ Neutral';
    }
}

function renderTable() {
    if (sectorsData.length === 0) {
        sectorTbody.innerHTML = `
            <tr class="loading-row">
                <td colspan="7">ไม่พบข้อมูล</td>
            </tr>
        `;
        return;
    }

    sectorTbody.innerHTML = sectorsData.map(sector => {
        const changeClass = sector.changePercent >= 0 ? 'positive' : 'negative';
        const changeSign = sector.changePercent >= 0 ? '+' : '';

        return `
            <tr>
                <td>
                    <div class="sector-name-cell">
                        <span class="sector-icon">${sector.icon}</span>
                        <span>${sector.name}</span>
                    </div>
                </td>
                <td><strong>${sector.symbol}</strong></td>
                <td>$${sector.price.toFixed(2)}</td>
                <td class="${changeClass}">${changeSign}${sector.changePercent.toFixed(2)}%</td>
                <td>${formatVolume(sector.volume)}</td>
                <td>${sector.volumeRatio}%</td>
                <td><span class="flow-badge ${sector.flowSignal}">${getFlowLabel(sector.flowSignal)}</span></td>
            </tr>
        `;
    }).join('');
}

function formatVolume(vol) {
    if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
    if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
    if (vol >= 1e3) return (vol / 1e3).toFixed(0) + 'K';
    return vol.toString();
}

function showLoading() {
    heatmapGrid.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <span>กำลังโหลดข้อมูล...</span>
        </div>
    `;
    sectorTbody.innerHTML = `
        <tr class="loading-row">
            <td colspan="7">กำลังโหลด...</td>
        </tr>
    `;
}

function showError() {
    heatmapGrid.innerHTML = `
        <div class="loading-state">
            <span>❌ เกิดข้อผิดพลาด กรุณาลองใหม่</span>
        </div>
    `;
}

function updateLastUpdate() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    lastUpdateEl.textContent = `อัปเดต: ${timeStr}`;
}
