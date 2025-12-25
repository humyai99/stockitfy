/**
 * Earnings Calendar - Frontend Logic
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
    let earningsData = [];
    let currentFilter = 'all';

    // ===================================
    // DOM Elements
    // ===================================
    const earningsGrid = document.getElementById('earnings-grid');
    const totalEarnings = document.getElementById('total-earnings');
    const thisWeek = document.getElementById('this-week');
    const nextEarning = document.getElementById('next-earning');
    const lastUpdate = document.getElementById('last-update');
    const refreshBtn = document.getElementById('refresh-btn');

    // ===================================
    // Initialize
    // ===================================
    function init() {
        // Event listeners
        refreshBtn.addEventListener('click', loadEarningsData);

        // Filter tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentFilter = tab.dataset.filter;
                renderEarnings();
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

        // Load data
        loadEarningsData();

        console.log('📅 Earnings Calendar initialized');
    }

    // ===================================
    // Load Earnings Data
    // ===================================
    async function loadEarningsData() {
        showLoading();

        try {
            const response = await fetch(`${API_BASE}/api/earnings`);

            if (!response.ok) {
                throw new Error('Failed to fetch earnings data');
            }

            const data = await response.json();
            earningsData = data.earnings || [];

            // Update stats
            updateStats();

            // Update last update time
            lastUpdate.textContent = `อัปเดต: ${new Date().toLocaleTimeString('th-TH')}`;

            renderEarnings();

        } catch (error) {
            console.error('Error loading earnings:', error);
            showError('ไม่สามารถโหลดข้อมูลได้');
        }
    }

    // ===================================
    // Update Stats
    // ===================================
    function updateStats() {
        const now = new Date();
        const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Total earnings
        totalEarnings.textContent = earningsData.length;

        // This week
        const weekCount = earningsData.filter(e => {
            const date = new Date(e.date);
            return date >= now && date <= weekEnd;
        }).length;
        thisWeek.textContent = weekCount;

        // Next earning
        if (earningsData.length > 0) {
            const next = earningsData[0];
            nextEarning.textContent = next.symbol;
        } else {
            nextEarning.textContent = '-';
        }
    }

    // ===================================
    // Render Earnings
    // ===================================
    function renderEarnings() {
        const now = new Date();
        const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const monthEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        let filtered = earningsData;

        if (currentFilter === 'week') {
            filtered = earningsData.filter(e => {
                const date = new Date(e.date);
                return date <= weekEnd;
            });
        } else if (currentFilter === 'month') {
            filtered = earningsData.filter(e => {
                const date = new Date(e.date);
                return date <= monthEnd;
            });
        }

        if (filtered.length === 0) {
            earningsGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <p>ไม่มีข้อมูล Earnings ในช่วงที่เลือก</p>
                </div>
            `;
            return;
        }

        earningsGrid.innerHTML = filtered.map(earning => {
            const date = new Date(earning.date);
            const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

            const daysUntil = earning.daysUntil;
            let countdownClass = '';
            let countdownText = `${daysUntil} วัน`;

            if (daysUntil === 0) {
                countdownClass = 'today';
                countdownText = 'วันนี้';
            } else if (daysUntil <= 3) {
                countdownClass = 'soon';
            } else if (daysUntil < 0) {
                countdownText = 'ผ่านแล้ว';
            }

            return `
                <div class="earning-card">
                    <div class="earning-date">
                        <span class="month">${months[date.getMonth()]}</span>
                        <span class="day">${date.getDate()}</span>
                        <span class="year">${date.getFullYear()}</span>
                    </div>
                    <div class="earning-info">
                        <span class="earning-symbol">${earning.symbol}</span>
                        <span class="earning-name">${earning.name}</span>
                        <div class="earning-meta">
                            <span>⏰ ${earning.time || 'TBD'}</span>
                            ${earning.epsEstimate ? `<span>📊 EPS Est: $${earning.epsEstimate.toFixed(2)}</span>` : ''}
                        </div>
                    </div>
                    <div class="earning-countdown">
                        <span class="countdown-value ${countdownClass}">${countdownText}</span>
                        <span class="countdown-label">countdown</span>
                    </div>
                    <a href="analyzer.html?symbol=${earning.symbol}" class="earning-action">วิเคราะห์</a>
                </div>
            `;
        }).join('');
    }

    // ===================================
    // Helper Functions
    // ===================================
    function showLoading() {
        earningsGrid.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <span>กำลังโหลดข้อมูล...</span>
            </div>
        `;
    }

    function showError(message) {
        earningsGrid.innerHTML = `
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
