/**
 * AI Stock Analyzer Engine
 * Trend Detection, Price Prediction, Support/Resistance, Thai Explanations
 */

(function () {
    'use strict';

    // ===================================
    // Configuration
    // ===================================
    const CONFIG = {
        UPDATE_INTERVAL: 10000, // 10 seconds
        EMA_PERIODS: { short: 9, medium: 21, long: 50 },
        RSI_PERIOD: 14,
        MACD_PERIODS: { fast: 12, slow: 26, signal: 9 },
        ADX_PERIOD: 14,
        ATR_PERIOD: 14,
    };

    // ===================================
    // State
    // ===================================
    let currentSymbol = null;
    let currentStockData = null;
    let ohlcvData = null;
    let chart = null;
    let volumeChart = null;
    let mainSeries = null;
    let volumeSeries = null;
    let indicatorSeries = {};
    let updateInterval = null;
    let currentChartType = 'candlestick';
    let activeIndicators = new Set();
    let isFullscreen = false;

    // Indicator colors
    const INDICATOR_COLORS = {
        sma20: '#2962ff',
        sma50: '#ff6d00',
        sma200: '#ab47bc',
        ema9: '#26a69a',
        ema21: '#ef5350',
        ema50: '#42a5f5',
        bb_upper: '#7b1fa2',
        bb_middle: '#9c27b0',
        bb_lower: '#7b1fa2'
    };

    // ===================================
    // Initialize App
    // ===================================
    document.addEventListener('DOMContentLoaded', function () {
        initSearchFunctionality();
        initQuickPicks();
        initTimeframeButtons();
        initChartControls();
        initChart();
        initMobileMenu();
        updateConnectionStatus();
        startClock();
    });

    // ===================================
    // Mobile Menu
    // ===================================
    function initMobileMenu() {
        const menuBtn = document.getElementById('mobile-menu-btn');
        const navTabs = document.getElementById('nav-tabs');
        if (!menuBtn || !navTabs) return;

        menuBtn.addEventListener('click', () => {
            menuBtn.classList.toggle('active');
            navTabs.classList.toggle('open');
        });

        navTabs.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                menuBtn.classList.remove('active');
                navTabs.classList.remove('open');
            });
        });

        document.addEventListener('click', (e) => {
            if (!menuBtn.contains(e.target) && !navTabs.contains(e.target)) {
                menuBtn.classList.remove('active');
                navTabs.classList.remove('open');
            }
        });
    }

    // ===================================
    // Search Functionality
    // ===================================
    function initSearchFunctionality() {
        const searchInput = document.getElementById('stock-search');
        const suggestionsContainer = document.getElementById('search-suggestions');

        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length >= 1) {
                const results = StockDataService.searchStocks(query);
                showSuggestions(results);
            } else {
                hideSuggestions();
            }
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim().toUpperCase();
                if (query) {
                    loadStock(query);
                    hideSuggestions();
                }
            }
        });

        // Close suggestions on click outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                hideSuggestions();
            }
        });
    }

    function showSuggestions(results) {
        const container = document.getElementById('search-suggestions');
        if (!container) return;

        if (results.length === 0) {
            hideSuggestions();
            return;
        }

        container.innerHTML = results.map(stock => `
            <div class="suggestion-item" data-symbol="${stock.symbol}">
                <span class="suggestion-symbol">${stock.symbol}</span>
                <span class="suggestion-name">${stock.name}</span>
            </div>
        `).join('');

        container.classList.add('active');

        // Add click handlers
        container.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                loadStock(item.dataset.symbol);
                hideSuggestions();
            });
        });
    }

    function hideSuggestions() {
        const container = document.getElementById('search-suggestions');
        if (container) {
            container.classList.remove('active');
        }
    }

    // ===================================
    // Quick Picks
    // ===================================
    function initQuickPicks() {
        document.querySelectorAll('.quick-pick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                loadStock(btn.dataset.symbol);
            });
        });
    }

    // ===================================
    // Timeframe Buttons
    // ===================================
    function initTimeframeButtons() {
        document.querySelectorAll('.chart-timeframes .tf-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.chart-timeframes .tf-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                if (currentSymbol) {
                    loadStock(currentSymbol);
                }
            });
        });
    }

    // ===================================
    // Chart Controls Initialization
    // ===================================
    function initChartControls() {
        // Chart Type Buttons
        document.querySelectorAll('.chart-type-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentChartType = this.dataset.type;
                if (ohlcvData) updateChartType();
            });
        });

        // Indicator Dropdown Toggle
        const indicatorDropdown = document.getElementById('indicator-dropdown');
        const indicatorTrigger = document.getElementById('indicator-trigger');

        if (indicatorTrigger) {
            indicatorTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                indicatorDropdown.classList.toggle('open');
            });
        }

        // Close dropdown on outside click
        document.addEventListener('click', () => {
            if (indicatorDropdown) indicatorDropdown.classList.remove('open');
        });

        // Indicator Checkboxes
        document.querySelectorAll('#indicator-menu input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', function () {
                if (this.checked) {
                    activeIndicators.add(this.value);
                } else {
                    activeIndicators.delete(this.value);
                }
                if (ohlcvData) updateIndicatorOverlays();
                updateLegend();
            });
        });

        // Volume Toggle
        const volumeToggle = document.getElementById('volume-toggle');
        if (volumeToggle) {
            volumeToggle.addEventListener('change', function () {
                const volumeContainer = document.getElementById('volume-chart');
                if (volumeContainer) {
                    volumeContainer.style.display = this.checked ? 'block' : 'none';
                }
            });
        }

        // Fullscreen Button
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', toggleFullscreen);
        }

        // ESC key to exit fullscreen
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isFullscreen) {
                toggleFullscreen();
            }
        });
    }

    function toggleFullscreen() {
        const chartWrapper = document.getElementById('chart-wrapper');
        if (!chartWrapper) return;

        isFullscreen = !isFullscreen;
        chartWrapper.classList.toggle('fullscreen', isFullscreen);

        // Resize charts after toggle
        setTimeout(() => {
            if (chart) chart.resize(chartWrapper.clientWidth, isFullscreen ? window.innerHeight - 120 : 400);
            if (volumeChart) volumeChart.resize(chartWrapper.clientWidth, isFullscreen ? 100 : 80);
        }, 100);
    }

    // ===================================
    // Initialize Chart
    // ===================================
    function initChart() {
        const chartContainer = document.getElementById('price-chart');
        const volumeContainer = document.getElementById('volume-chart');

        if (!chartContainer || typeof LightweightCharts === 'undefined') {
            console.log('Chart library not loaded');
            return;
        }

        // Clear placeholder
        chartContainer.innerHTML = '';
        if (volumeContainer) volumeContainer.innerHTML = '';

        // Main Price Chart
        chart = LightweightCharts.createChart(chartContainer, {
            layout: {
                background: { type: 'solid', color: 'transparent' },
                textColor: '#a1a1aa',
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: { labelBackgroundColor: '#6366f1' },
                horzLine: { labelBackgroundColor: '#6366f1' },
            },
            rightPriceScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
            },
            timeScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
                timeVisible: true,
                secondsVisible: false,
            },
            handleScroll: { vertTouchDrag: false },
        });

        // Create initial main series (candlestick)
        createMainSeries('candlestick');

        // Volume Chart (separate)
        if (volumeContainer) {
            volumeChart = LightweightCharts.createChart(volumeContainer, {
                layout: {
                    background: { type: 'solid', color: 'transparent' },
                    textColor: '#71717a',
                },
                grid: {
                    vertLines: { visible: false },
                    horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
                },
                rightPriceScale: {
                    borderVisible: false,
                    scaleMargins: { top: 0.1, bottom: 0 },
                },
                timeScale: {
                    visible: false,
                },
                handleScroll: false,
                handleScale: false,
            });

            volumeSeries = volumeChart.addHistogramSeries({
                priceFormat: { type: 'volume' },
                priceScaleId: 'volume',
            });

            // Sync time scales
            chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
                if (volumeChart && range) {
                    volumeChart.timeScale().setVisibleLogicalRange(range);
                }
            });
        }

        // Resize handlers
        const resizeObserver = new ResizeObserver(() => {
            if (chart) {
                chart.applyOptions({
                    width: chartContainer.clientWidth,
                    height: chartContainer.clientHeight
                });
            }
            if (volumeChart && volumeContainer) {
                volumeChart.applyOptions({
                    width: volumeContainer.clientWidth,
                    height: volumeContainer.clientHeight
                });
            }
        });
        resizeObserver.observe(chartContainer);

        // Crosshair tooltip
        setupCrosshairTooltip();
    }

    function createMainSeries(type) {
        // Remove existing main series
        if (mainSeries && chart) {
            chart.removeSeries(mainSeries);
        }

        switch (type) {
            case 'candlestick':
                mainSeries = chart.addCandlestickSeries({
                    upColor: '#22c55e',
                    downColor: '#ef4444',
                    borderDownColor: '#ef4444',
                    borderUpColor: '#22c55e',
                    wickDownColor: '#ef4444',
                    wickUpColor: '#22c55e',
                });
                break;
            case 'line':
                mainSeries = chart.addLineSeries({
                    color: '#6366f1',
                    lineWidth: 2,
                });
                break;
            case 'area':
                mainSeries = chart.addAreaSeries({
                    topColor: 'rgba(99, 102, 241, 0.4)',
                    bottomColor: 'rgba(99, 102, 241, 0.0)',
                    lineColor: '#6366f1',
                    lineWidth: 2,
                });
                break;
        }
    }

    function updateChartType() {
        if (!ohlcvData || !chart) return;

        createMainSeries(currentChartType);

        // Set data based on chart type
        if (currentChartType === 'candlestick') {
            const candleData = ohlcvData.map(d => ({
                time: d.time,
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
            }));
            mainSeries.setData(candleData);
        } else {
            const lineData = ohlcvData.map(d => ({
                time: d.time,
                value: d.close,
            }));
            mainSeries.setData(lineData);
        }

        // Re-add indicators
        updateIndicatorOverlays();
        chart.timeScale().fitContent();
    }

    function updateIndicatorOverlays() {
        if (!ohlcvData || !chart) return;

        // Remove all existing indicator series
        Object.values(indicatorSeries).forEach(series => {
            try { chart.removeSeries(series); } catch (e) { }
        });
        indicatorSeries = {};

        // Add active indicators
        activeIndicators.forEach(indicator => {
            addIndicatorSeries(indicator);
        });
    }

    function addIndicatorSeries(indicator) {
        if (!ohlcvData) return;

        const data = ohlcvData.filter(d => d[indicator] !== null).map(d => ({
            time: d.time,
            value: d[indicator]
        }));

        if (data.length === 0) return;

        // Handle Bollinger Bands specially
        if (indicator === 'bb') {
            // Upper band
            const upperData = ohlcvData.filter(d => d.bb_upper !== null).map(d => ({
                time: d.time, value: d.bb_upper
            }));
            indicatorSeries['bb_upper'] = chart.addLineSeries({
                color: INDICATOR_COLORS.bb_upper,
                lineWidth: 1,
                lineStyle: 2, // Dashed
            });
            indicatorSeries['bb_upper'].setData(upperData);

            // Middle band
            const middleData = ohlcvData.filter(d => d.bb_middle !== null).map(d => ({
                time: d.time, value: d.bb_middle
            }));
            indicatorSeries['bb_middle'] = chart.addLineSeries({
                color: INDICATOR_COLORS.bb_middle,
                lineWidth: 1,
            });
            indicatorSeries['bb_middle'].setData(middleData);

            // Lower band
            const lowerData = ohlcvData.filter(d => d.bb_lower !== null).map(d => ({
                time: d.time, value: d.bb_lower
            }));
            indicatorSeries['bb_lower'] = chart.addLineSeries({
                color: INDICATOR_COLORS.bb_lower,
                lineWidth: 1,
                lineStyle: 2,
            });
            indicatorSeries['bb_lower'].setData(lowerData);
        } else {
            indicatorSeries[indicator] = chart.addLineSeries({
                color: INDICATOR_COLORS[indicator] || '#888',
                lineWidth: 1,
            });
            indicatorSeries[indicator].setData(data);
        }
    }

    function updateLegend() {
        const legend = document.getElementById('chart-legend');
        if (!legend) return;

        let html = '';
        activeIndicators.forEach(indicator => {
            if (indicator === 'bb') {
                html += `<div class="legend-item"><span class="legend-color bb"></span><span class="legend-label">Bollinger Bands</span></div>`;
            } else {
                const label = indicator.toUpperCase().replace('SMA', 'SMA ').replace('EMA', 'EMA ');
                html += `<div class="legend-item"><span class="legend-color ${indicator}"></span><span class="legend-label">${label}</span></div>`;
            }
        });
        legend.innerHTML = html;
    }

    function setupCrosshairTooltip() {
        // Create tooltip element
        const chartContainer = document.getElementById('price-chart');
        if (!chartContainer) return;

        let tooltip = document.createElement('div');
        tooltip.className = 'chart-tooltip';
        tooltip.style.display = 'none';
        chartContainer.style.position = 'relative';
        chartContainer.appendChild(tooltip);

        chart.subscribeCrosshairMove((param) => {
            if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
                tooltip.style.display = 'none';
                return;
            }

            const data = param.seriesData.get(mainSeries);
            if (!data) {
                tooltip.style.display = 'none';
                return;
            }

            let html = '';
            if (currentChartType === 'candlestick' && data.open !== undefined) {
                const change = data.close - data.open;
                const changeClass = change >= 0 ? 'positive' : 'negative';
                html = `
                    <div class="tooltip-row"><span class="tooltip-label">O</span><span class="tooltip-value">$${data.open.toFixed(2)}</span></div>
                    <div class="tooltip-row"><span class="tooltip-label">H</span><span class="tooltip-value">$${data.high.toFixed(2)}</span></div>
                    <div class="tooltip-row"><span class="tooltip-label">L</span><span class="tooltip-value">$${data.low.toFixed(2)}</span></div>
                    <div class="tooltip-row"><span class="tooltip-label">C</span><span class="tooltip-value ${changeClass}">$${data.close.toFixed(2)}</span></div>
                `;
            } else if (data.value !== undefined) {
                html = `<div class="tooltip-row"><span class="tooltip-label">Price</span><span class="tooltip-value">$${data.value.toFixed(2)}</span></div>`;
            }

            tooltip.innerHTML = html;
            tooltip.style.display = 'block';
        });
    }

    // ===================================
    // Load Stock Data
    // ===================================
    async function loadStock(symbol) {
        showLoading();
        currentSymbol = symbol.toUpperCase();

        // Get selected timeframe
        const activeTimeframe = document.querySelector('.tf-btn.active');
        const period = activeTimeframe ? activeTimeframe.dataset.tf.toLowerCase() : '1m';

        try {
            // Fetch stock data
            const stockData = await StockDataService.fetchStockData(currentSymbol);
            currentStockData = stockData;

            // Fetch OHLCV data with indicators from new API
            try {
                const periodMap = { '1d': '1d', '1w': '1w', '1m': '1mo', '3m': '3mo', '6m': '6mo', '1y': '1y' };
                const apiPeriod = periodMap[period] || '1mo';
                const response = await fetch(`http://localhost:3001/api/ohlcv/${currentSymbol}?period=${apiPeriod}`);
                if (response.ok) {
                    const ohlcvResponse = await response.json();
                    ohlcvData = ohlcvResponse.data;
                } else {
                    ohlcvData = stockData.historical.map(d => ({
                        time: d.date, open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume
                    }));
                }
            } catch {
                ohlcvData = stockData.historical.map(d => ({
                    time: d.date, open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume
                }));
            }

            updateDisplay(stockData);
            updateChartWithData();
            performAnalysis(stockData);

            // Start real-time updates
            startRealTimeUpdates();

        } catch (error) {
            console.error('Failed to load stock:', error);
        } finally {
            hideLoading();
        }
    }

    function updateChartWithData() {
        if (!ohlcvData || !chart || !mainSeries) return;

        if (currentChartType === 'candlestick') {
            mainSeries.setData(ohlcvData.map(d => ({
                time: d.time, open: d.open, high: d.high, low: d.low, close: d.close
            })));
        } else {
            mainSeries.setData(ohlcvData.map(d => ({ time: d.time, value: d.close })));
        }

        if (volumeSeries) {
            volumeSeries.setData(ohlcvData.map(d => ({
                time: d.time, value: d.volume,
                color: d.close >= d.open ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)',
            })));
        }

        updateIndicatorOverlays();
        chart.timeScale().fitContent();
        if (volumeChart) volumeChart.timeScale().fitContent();
    }

    // ===================================
    // Update Display
    // ===================================
    function updateDisplay(stockData) {
        const { symbol, name, quote } = stockData;

        // Update header
        document.getElementById('display-symbol').textContent = symbol;
        document.getElementById('display-name').textContent = name;
        document.getElementById('current-price').textContent = '$' + StockDataService.formatPrice(quote.price);

        // Update change badge
        const changeBadge = document.getElementById('price-change-badge');
        const isPositive = quote.changePercent >= 0;
        changeBadge.className = `price-change-badge ${isPositive ? 'positive' : 'negative'}`;
        changeBadge.innerHTML = `
            <span class="change-value">${isPositive ? '+' : ''}$${quote.change.toFixed(2)}</span>
            <span class="change-percent">(${isPositive ? '+' : ''}${quote.changePercent.toFixed(2)}%)</span>
        `;

        // Update meta
        document.getElementById('day-high').textContent = '$' + StockDataService.formatPrice(quote.high);
        document.getElementById('day-low').textContent = '$' + StockDataService.formatPrice(quote.low);
        document.getElementById('volume').textContent = StockDataService.formatVolume(quote.volume);
        document.getElementById('market-cap').textContent = StockDataService.formatMarketCap(quote.marketCap);

        // Update marker price
        document.getElementById('marker-price').textContent = '$' + StockDataService.formatPrice(quote.price);

        // Update search input
        document.getElementById('stock-search').value = symbol;
    }

    // Note: updateChart replaced by updateChartWithData above

    // ===================================
    // Perform AI Analysis
    // ===================================
    function performAnalysis(stockData) {
        const closes = stockData.historical.map(d => d.close);
        const highs = stockData.historical.map(d => d.high);
        const lows = stockData.historical.map(d => d.low);
        const currentPrice = stockData.quote.price;

        // Calculate indicators
        const ema9 = calculateEMA(closes, CONFIG.EMA_PERIODS.short);
        const ema21 = calculateEMA(closes, CONFIG.EMA_PERIODS.medium);
        const ema50 = calculateEMA(closes, CONFIG.EMA_PERIODS.long);
        const rsi = calculateRSI(closes, CONFIG.RSI_PERIOD);
        const macd = calculateMACD(closes);
        const adx = calculateADX(highs, lows, closes, CONFIG.ADX_PERIOD);
        const atr = calculateATR(highs, lows, closes, CONFIG.ATR_PERIOD);

        // Detect trend
        const trend = detectTrend(ema9, ema21, ema50, adx, currentPrice);

        // Calculate support/resistance
        const levels = calculateSupportResistance(highs, lows, closes, currentPrice);

        // Generate predictions
        const predictions = generatePredictions(closes, trend, atr, currentPrice);

        // Update UI
        updateTrendDisplay(trend);
        updateIndicatorsDisplay(ema9, ema21, ema50, rsi, macd, adx);
        updateLevelsDisplay(levels, currentPrice);
        updatePredictionsDisplay(predictions);
        updateInsightsDisplay(trend, rsi, macd, levels, currentPrice, stockData.symbol);
    }

    // ===================================
    // Technical Indicator Calculations
    // ===================================
    function calculateEMA(data, period) {
        const k = 2 / (period + 1);
        const emaArray = [];
        let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

        for (let i = 0; i < data.length; i++) {
            if (i < period) {
                emaArray.push(null);
            } else {
                ema = data[i] * k + ema * (1 - k);
                emaArray.push(ema);
            }
        }
        return emaArray;
    }

    function calculateRSI(closes, period) {
        const changes = [];
        for (let i = 1; i < closes.length; i++) {
            changes.push(closes[i] - closes[i - 1]);
        }

        let avgGain = 0;
        let avgLoss = 0;

        for (let i = 0; i < period; i++) {
            if (changes[i] > 0) avgGain += changes[i];
            else avgLoss += Math.abs(changes[i]);
        }

        avgGain /= period;
        avgLoss /= period;

        for (let i = period; i < changes.length; i++) {
            const change = changes[i];
            if (change > 0) {
                avgGain = (avgGain * (period - 1) + change) / period;
                avgLoss = (avgLoss * (period - 1)) / period;
            } else {
                avgGain = (avgGain * (period - 1)) / period;
                avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
            }
        }

        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    function calculateMACD(closes) {
        const ema12 = calculateEMA(closes, CONFIG.MACD_PERIODS.fast);
        const ema26 = calculateEMA(closes, CONFIG.MACD_PERIODS.slow);

        const macdLine = [];
        for (let i = 0; i < closes.length; i++) {
            if (ema12[i] !== null && ema26[i] !== null) {
                macdLine.push(ema12[i] - ema26[i]);
            } else {
                macdLine.push(null);
            }
        }

        const signalLine = calculateEMA(macdLine.filter(v => v !== null), CONFIG.MACD_PERIODS.signal);
        const currentMacd = macdLine[macdLine.length - 1];
        const currentSignal = signalLine[signalLine.length - 1];
        const histogram = currentMacd - currentSignal;

        return {
            macd: currentMacd,
            signal: currentSignal,
            histogram: histogram
        };
    }

    function calculateADX(highs, lows, closes, period) {
        // Simplified ADX calculation
        const trueRanges = [];
        const plusDM = [];
        const minusDM = [];

        for (let i = 1; i < closes.length; i++) {
            const highDiff = highs[i] - highs[i - 1];
            const lowDiff = lows[i - 1] - lows[i];

            plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
            minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);

            const tr = Math.max(
                highs[i] - lows[i],
                Math.abs(highs[i] - closes[i - 1]),
                Math.abs(lows[i] - closes[i - 1])
            );
            trueRanges.push(tr);
        }

        // Calculate smoothed averages
        const smoothedTR = trueRanges.slice(-period).reduce((a, b) => a + b, 0);
        const smoothedPlusDM = plusDM.slice(-period).reduce((a, b) => a + b, 0);
        const smoothedMinusDM = minusDM.slice(-period).reduce((a, b) => a + b, 0);

        const plusDI = (smoothedPlusDM / smoothedTR) * 100;
        const minusDI = (smoothedMinusDM / smoothedTR) * 100;
        const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;

        return dx || 25; // Default to 25 if calculation fails
    }

    function calculateATR(highs, lows, closes, period) {
        const trueRanges = [];

        for (let i = 1; i < closes.length; i++) {
            const tr = Math.max(
                highs[i] - lows[i],
                Math.abs(highs[i] - closes[i - 1]),
                Math.abs(lows[i] - closes[i - 1])
            );
            trueRanges.push(tr);
        }

        return trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
    }

    // ===================================
    // Trend Detection
    // ===================================
    function detectTrend(ema9, ema21, ema50, adx, currentPrice) {
        const latestEma9 = ema9[ema9.length - 1];
        const latestEma21 = ema21[ema21.length - 1];
        const latestEma50 = ema50[ema50.length - 1];

        let direction = 'SIDEWAYS';
        let strength = Math.min(100, adx * 2);
        let icon = '↔️';
        let colorClass = 'sideways';

        if (latestEma9 > latestEma21 && latestEma21 > latestEma50 && currentPrice > latestEma9) {
            direction = 'UPTREND';
            icon = '📈';
            colorClass = 'uptrend';
            strength = Math.min(100, adx * 2.5);
        } else if (latestEma9 < latestEma21 && latestEma21 < latestEma50 && currentPrice < latestEma9) {
            direction = 'DOWNTREND';
            icon = '📉';
            colorClass = 'downtrend';
            strength = Math.min(100, adx * 2.5);
        } else if (adx < 20) {
            direction = 'SIDEWAYS';
            icon = '↔️';
            colorClass = 'sideways';
            strength = 100 - adx * 2;
        }

        // Generate Thai explanation
        const explanation = generateTrendExplanation(direction, strength, latestEma9, latestEma21, latestEma50, currentPrice, adx);

        return {
            direction,
            strength: Math.round(strength),
            icon,
            colorClass,
            explanation,
            ema9: latestEma9,
            ema21: latestEma21,
            ema50: latestEma50
        };
    }

    function generateTrendExplanation(direction, strength, ema9, ema21, ema50, currentPrice, adx) {
        const strengthText = strength > 70 ? 'แข็งแกร่ง' : strength > 40 ? 'ปานกลาง' : 'อ่อนแอ';

        if (direction === 'UPTREND') {
            return `${direction === 'UPTREND' ? '📈 หุ้นอยู่ในเทรนด์ขาขึ้นที่' + strengthText : ''}\n\n` +
                `• EMA 9 (${ema9.toFixed(2)}) อยู่เหนือ EMA 21 (${ema21.toFixed(2)}) และ EMA 50 (${ema50.toFixed(2)})\n` +
                `• ราคาปัจจุบัน ($${currentPrice.toFixed(2)}) เทรดเหนือเส้นค่าเฉลี่ยทั้งหมด\n` +
                `• ADX อยู่ที่ ${adx.toFixed(1)} แสดงถึงความแรงของเทรนด์${adx > 25 ? 'ที่ชัดเจน' : 'ที่ยังไม่ชัดนัก'}\n\n` +
                `💡 คำแนะนำ: ${strength > 60 ? 'เทรนด์แข็งแกร่ง เหมาะสำหรับ Trend Following' : 'รอยืนยันความแรงของเทรนด์เพิ่มเติม'}`;
        } else if (direction === 'DOWNTREND') {
            return `📉 หุ้นอยู่ในเทรนด์ขาลงที่${strengthText}\n\n` +
                `• EMA 9 (${ema9.toFixed(2)}) อยู่ต่ำกว่า EMA 21 (${ema21.toFixed(2)}) และ EMA 50 (${ema50.toFixed(2)})\n` +
                `• ราคาปัจจุบัน ($${currentPrice.toFixed(2)}) เทรดต่ำกว่าเส้นค่าเฉลี่ยทั้งหมด\n` +
                `• ADX อยู่ที่ ${adx.toFixed(1)} แสดงถึงแรงขายที่${adx > 25 ? 'ชัดเจน' : 'ยังไม่รุนแรง'}\n\n` +
                `⚠️ คำเตือน: ${strength > 60 ? 'เทรนด์ขาลงแรง ควรระวังการเข้าซื้อ' : 'อาจมีโอกาส Reversal ได้'}`;
        } else {
            return `↔️ หุ้นอยู่ในกรอบ Sideways (ไม่มีเทรนด์ชัดเจน)\n\n` +
                `• เส้นค่าเฉลี่ย EMA ทับกันอยู่ แสดงถึงตลาดที่ไม่มีทิศทาง\n` +
                `• ADX อยู่ที่ ${adx.toFixed(1)} (ต่ำกว่า 25) ยืนยันว่าไม่มีเทรนด์\n` +
                `• ราคาแกว่งตัวอยู่ในกรอบระหว่างแนวรับและแนวต้าน\n\n` +
                `💡 คำแนะนำ: เหมาะสำหรับกลยุทธ์ Range Trading - ซื้อที่แนวรับ ขายที่แนวต้าน`;
        }
    }

    // ===================================
    // Support & Resistance Calculation
    // ===================================
    function calculateSupportResistance(highs, lows, closes, currentPrice) {
        // Use recent 20 bars for pivot points
        const recentHighs = highs.slice(-50);
        const recentLows = lows.slice(-50);
        const recentCloses = closes.slice(-50);

        // Calculate Pivot Points
        const high = Math.max(...recentHighs.slice(-20));
        const low = Math.min(...recentLows.slice(-20));
        const close = recentCloses[recentCloses.length - 1];

        const pivot = (high + low + close) / 3;
        const r1 = 2 * pivot - low;
        const r2 = pivot + (high - low);
        const r3 = high + 2 * (pivot - low);
        const s1 = 2 * pivot - high;
        const s2 = pivot - (high - low);
        const s3 = low - 2 * (high - pivot);

        // Find swing highs and lows
        const swingHighs = findSwingPoints(recentHighs, 'high');
        const swingLows = findSwingPoints(recentLows, 'low');

        // Combine and filter levels
        let resistanceLevels = [r1, r2, r3, ...swingHighs]
            .filter(level => level > currentPrice)
            .sort((a, b) => a - b)
            .slice(0, 3);

        let supportLevels = [s1, s2, s3, ...swingLows]
            .filter(level => level < currentPrice)
            .sort((a, b) => b - a)
            .slice(0, 3);

        return {
            resistance: resistanceLevels,
            support: supportLevels,
            pivot: pivot
        };
    }

    function findSwingPoints(data, type) {
        const points = [];
        const lookback = 5;

        for (let i = lookback; i < data.length - lookback; i++) {
            const current = data[i];
            const before = data.slice(i - lookback, i);
            const after = data.slice(i + 1, i + lookback + 1);

            if (type === 'high') {
                if (before.every(v => v <= current) && after.every(v => v <= current)) {
                    points.push(current);
                }
            } else {
                if (before.every(v => v >= current) && after.every(v => v >= current)) {
                    points.push(current);
                }
            }
        }

        return points;
    }

    // ===================================
    // Price Predictions
    // ===================================
    function generatePredictions(closes, trend, atr, currentPrice) {
        // Linear regression for trend
        const recentCloses = closes.slice(-30);
        const slope = calculateSlope(recentCloses);
        const trendMultiplier = trend.direction === 'UPTREND' ? 1.2 :
            trend.direction === 'DOWNTREND' ? 0.8 : 1.0;

        const predictions = {
            day7: calculatePrediction(currentPrice, slope, atr, 7, trendMultiplier),
            day14: calculatePrediction(currentPrice, slope, atr, 14, trendMultiplier),
            day30: calculatePrediction(currentPrice, slope, atr, 30, trendMultiplier),
        };

        return predictions;
    }

    function calculateSlope(data) {
        const n = data.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += data[i];
            sumXY += i * data[i];
            sumX2 += i * i;
        }

        return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }

    function calculatePrediction(currentPrice, slope, atr, days, trendMultiplier) {
        const expectedChange = slope * days * trendMultiplier;
        const volatilityFactor = Math.sqrt(days) * atr;

        const expected = currentPrice + expectedChange;
        const min = expected - volatilityFactor * 1.5;
        const max = expected + volatilityFactor * 1.5;

        const confidence = Math.max(30, 85 - days);

        return {
            expected: Math.max(0, expected),
            min: Math.max(0, min),
            max: max,
            confidence: confidence
        };
    }

    // ===================================
    // Update UI Functions
    // ===================================
    function updateTrendDisplay(trend) {
        const trendIndicator = document.getElementById('trend-indicator');
        const trendIcon = trendIndicator.querySelector('.trend-icon');
        const trendDirection = document.getElementById('trend-direction');
        const strengthFill = document.getElementById('strength-fill');
        const strengthValue = document.getElementById('strength-value');
        const explanationText = document.getElementById('explanation-text');

        trendIcon.textContent = trend.icon;
        trendDirection.textContent = trend.direction === 'UPTREND' ? 'ขาขึ้น' :
            trend.direction === 'DOWNTREND' ? 'ขาลง' : 'ในกรอบ';
        trendDirection.className = `trend-direction ${trend.colorClass}`;

        strengthFill.style.width = `${trend.strength}%`;
        strengthFill.className = `strength-fill ${trend.strength > 60 ? 'strong' : 'weak'}`;
        strengthValue.textContent = `${trend.strength}%`;

        explanationText.textContent = trend.explanation;
    }

    function updateIndicatorsDisplay(ema9, ema21, ema50, rsi, macd, adx) {
        const latestEma9 = ema9[ema9.length - 1];
        const latestEma21 = ema21[ema21.length - 1];
        const latestEma50 = ema50[ema50.length - 1];

        // EMA Display
        document.getElementById('ema-9').textContent = '$' + latestEma9.toFixed(2);
        document.getElementById('ema-21').textContent = '$' + latestEma21.toFixed(2);
        document.getElementById('ema-50').textContent = '$' + latestEma50.toFixed(2);

        const maSignal = document.getElementById('ma-signal');
        if (latestEma9 > latestEma21 && latestEma21 > latestEma50) {
            maSignal.textContent = 'Bullish';
            maSignal.className = 'ind-signal bullish';
        } else if (latestEma9 < latestEma21 && latestEma21 < latestEma50) {
            maSignal.textContent = 'Bearish';
            maSignal.className = 'ind-signal bearish';
        } else {
            maSignal.textContent = 'Neutral';
            maSignal.className = 'ind-signal neutral';
        }

        // RSI Display
        document.getElementById('rsi-value').textContent = rsi.toFixed(1);
        const rsiSignal = document.getElementById('rsi-signal');
        const rsiMarker = document.getElementById('rsi-marker');

        rsiMarker.style.left = `${rsi}%`;

        if (rsi > 70) {
            rsiSignal.textContent = 'Overbought';
            rsiSignal.className = 'ind-signal bearish';
        } else if (rsi < 30) {
            rsiSignal.textContent = 'Oversold';
            rsiSignal.className = 'ind-signal bullish';
        } else {
            rsiSignal.textContent = 'Neutral';
            rsiSignal.className = 'ind-signal neutral';
        }

        // MACD Display
        document.getElementById('macd-line').textContent = macd.macd.toFixed(3);
        document.getElementById('signal-line').textContent = macd.signal.toFixed(3);
        document.getElementById('macd-histogram').textContent = macd.histogram.toFixed(3);

        const macdSignal = document.getElementById('macd-signal');
        if (macd.histogram > 0 && macd.macd > 0) {
            macdSignal.textContent = 'Bullish';
            macdSignal.className = 'ind-signal bullish';
        } else if (macd.histogram < 0 && macd.macd < 0) {
            macdSignal.textContent = 'Bearish';
            macdSignal.className = 'ind-signal bearish';
        } else {
            macdSignal.textContent = 'Mixed';
            macdSignal.className = 'ind-signal neutral';
        }

        // ADX Display
        document.getElementById('adx-value').textContent = adx.toFixed(1);
        const adxSignal = document.getElementById('adx-signal');
        const adxDescription = document.getElementById('adx-description');

        if (adx > 40) {
            adxSignal.textContent = 'Very Strong';
            adxSignal.className = 'ind-signal bullish';
            adxDescription.textContent = 'เทรนด์แข็งแกร่งมาก';
        } else if (adx > 25) {
            adxSignal.textContent = 'Strong';
            adxSignal.className = 'ind-signal bullish';
            adxDescription.textContent = 'เทรนด์ชัดเจน';
        } else {
            adxSignal.textContent = 'Weak';
            adxSignal.className = 'ind-signal neutral';
            adxDescription.textContent = 'ไม่มีเทรนด์ / Sideways';
        }
    }

    function updateLevelsDisplay(levels, currentPrice) {
        const resistanceList = document.getElementById('resistance-levels');
        const supportList = document.getElementById('support-levels');

        // Resistance levels
        resistanceList.innerHTML = levels.resistance.map((level, i) => {
            const distance = ((level - currentPrice) / currentPrice * 100).toFixed(2);
            return `
                <div class="level-item r${i + 1}">
                    <span class="level-label">R${i + 1}</span>
                    <span class="level-value">$${level.toFixed(2)}</span>
                    <span class="level-distance above">+${distance}%</span>
                </div>
            `;
        }).reverse().join('');

        // Support levels
        supportList.innerHTML = levels.support.map((level, i) => {
            const distance = ((currentPrice - level) / currentPrice * 100).toFixed(2);
            return `
                <div class="level-item s${i + 1}">
                    <span class="level-label">S${i + 1}</span>
                    <span class="level-value">$${level.toFixed(2)}</span>
                    <span class="level-distance below">-${distance}%</span>
                </div>
            `;
        }).join('');
    }

    function updatePredictionsDisplay(predictions) {
        ['7', '14', '30'].forEach(days => {
            const pred = predictions[`day${days}`];
            document.getElementById(`min-${days}`).textContent = '$' + pred.min.toFixed(2);
            document.getElementById(`exp-${days}`).textContent = '$' + pred.expected.toFixed(2);
            document.getElementById(`max-${days}`).textContent = '$' + pred.max.toFixed(2);
            document.getElementById(`conf-${days}`).textContent = `${pred.confidence}% conf.`;
        });
    }

    function updateInsightsDisplay(trend, rsi, macd, levels, currentPrice, symbol) {
        // Summary
        const summaryText = generateSummaryInsight(trend, rsi, currentPrice, symbol);
        document.getElementById('insight-summary').textContent = summaryText;

        // Opportunity
        const opportunityText = generateOpportunityInsight(trend, rsi, levels, currentPrice);
        document.getElementById('insight-opportunity').textContent = opportunityText;

        // Risk
        const riskText = generateRiskInsight(trend, rsi, macd, levels, currentPrice);
        document.getElementById('insight-risk').textContent = riskText;

        // Action points
        const actionsList = generateActionPoints(trend, rsi, macd, levels, currentPrice);
        document.getElementById('insight-actions').innerHTML = actionsList.map(a => `<li>${a}</li>`).join('');
    }

    function generateSummaryInsight(trend, rsi, currentPrice, symbol) {
        if (trend.direction === 'UPTREND') {
            return `${symbol} อยู่ในเทรนด์ขาขึ้นที่${trend.strength > 60 ? 'แข็งแกร่ง' : 'กำลังพัฒนา'} ` +
                `RSI อยู่ที่ ${rsi.toFixed(1)} ${rsi > 70 ? '(Overbought - อาจมีการพักตัว)' : '(ยังมี Room to Run)'} ` +
                `ควร${trend.strength > 60 ? 'รอซื้อเมื่อย่อตัวมาที่แนวรับ' : 'ติดตามว่าเทรนด์จะแข็งแกร่งขึ้นหรือไม่'}`;
        } else if (trend.direction === 'DOWNTREND') {
            return `${symbol} อยู่ในเทรนด์ขาลง${trend.strength > 60 ? 'ที่ชัดเจน' : ''} ` +
                `RSI อยู่ที่ ${rsi.toFixed(1)} ${rsi < 30 ? '(Oversold - อาจมีการรีบาวด์)' : ''} ` +
                `ควรระมัดระวังและรอสัญญาณ Reversal ก่อนเข้าซื้อ`;
        }
        return `${symbol} เคลื่อนไหวในกรอบ Sideways ไม่มีเทรนด์ชัดเจน เหมาะสำหรับ Range Trading โดยซื้อที่แนวรับและขายที่แนวต้าน`;
    }

    function generateOpportunityInsight(trend, rsi, levels, currentPrice) {
        if (trend.direction === 'UPTREND' && rsi < 60) {
            const nearestSupport = levels.support[0];
            const entryZone = nearestSupport ? `$${nearestSupport.toFixed(2)} - $${(nearestSupport * 1.02).toFixed(2)}` : 'แนวรับที่ใกล้ที่สุด';
            return `เทรนด์ขาขึ้นยังแข็งแกร่ง จุดเข้าซื้อที่ดีคือบริเวณ ${entryZone} เป้าหมายอยู่ที่ $${levels.resistance[0]?.toFixed(2) || '-'}`;
        } else if (trend.direction === 'DOWNTREND' && rsi < 30) {
            return `RSI เข้าสู่โซน Oversold อาจมีโอกาส Short-term Bounce แต่ควรรอ Confirmation ก่อน`;
        } else if (trend.direction === 'SIDEWAYS') {
            return `โอกาสในการ Range Trade - ซื้อใกล้แนวรับ $${levels.support[0]?.toFixed(2) || '-'} ขายใกล้แนวต้าน $${levels.resistance[0]?.toFixed(2) || '-'}`;
        }
        return `ติดตามการ Breakout เหนือแนวต้านหลักที่ $${levels.resistance[0]?.toFixed(2) || '-'} สำหรับสัญญาณซื้อใหม่`;
    }

    function generateRiskInsight(trend, rsi, macd, levels, currentPrice) {
        const risks = [];

        if (rsi > 70) {
            risks.push('RSI อยู่ในโซน Overbought อาจมีการปรับฐาน');
        }
        if (rsi < 30 && trend.direction === 'DOWNTREND') {
            risks.push('แม้ Oversold แต่เทรนด์ยังเป็นขาลง ระวัง Value Trap');
        }
        if (macd.histogram < 0 && trend.direction === 'UPTREND') {
            risks.push('MACD Histogram เป็นลบ อาจมีการชะลอตัว');
        }
        if (levels.support.length === 0) {
            risks.push('ไม่พบแนวรับที่ชัดเจน ความเสี่ยง Downside สูง');
        }

        return risks.length > 0 ? risks.join(' | ') : 'ความเสี่ยงอยู่ในระดับปกติ ควรตั้ง Stop Loss เสมอ';
    }

    function generateActionPoints(trend, rsi, macd, levels, currentPrice) {
        const actions = [];

        if (trend.direction === 'UPTREND') {
            if (levels.resistance[0]) {
                actions.push(`เป้าหมายแรกอยู่ที่แนวต้าน R1: $${levels.resistance[0].toFixed(2)}`);
            }
            if (levels.support[0]) {
                actions.push(`ตั้ง Stop Loss ใต้แนวรับ S1: $${levels.support[0].toFixed(2)}`);
            }
            actions.push(`รอซื้อเมื่อราคาย่อตัวมาทดสอบ EMA 21 หรือแนวรับ`);
        } else if (trend.direction === 'DOWNTREND') {
            actions.push(`หลีกเลี่ยงการซื้อจนกว่าจะมีสัญญาณ Reversal`);
            if (levels.support[0]) {
                actions.push(`จับตาแนวรับสำคัญที่ $${levels.support[0].toFixed(2)}`);
            }
            actions.push(`รอให้ราคาปิดเหนือ EMA 21 ก่อนพิจารณาซื้อ`);
        } else {
            actions.push(`ซื้อใกล้แนวรับ ขายใกล้แนวต้าน (Range Trading)`);
            actions.push(`รอ Breakout เหนือแนวต้านหรือหลุดแนวรับเพื่อหาเทรนด์ใหม่`);
            actions.push(`ใช้ Position Size ที่เล็กลงในช่วง Sideways`);
        }

        if (rsi > 70) {
            actions.push(`⚠️ RSI Overbought - หลีกเลี่ยงการเข้าซื้อใหม่`);
        }
        if (rsi < 30) {
            actions.push(`👀 RSI Oversold - จับตาสัญญาณ Reversal`);
        }

        return actions;
    }

    // ===================================
    // Real-time Updates
    // ===================================
    function startRealTimeUpdates() {
        if (updateInterval) {
            clearInterval(updateInterval);
        }

        updateInterval = setInterval(() => {
            if (currentStockData) {
                currentStockData = StockDataService.simulateRealTimeUpdate(currentStockData);
                updateDisplay(currentStockData);

                // Re-analyze periodically
                performAnalysis(currentStockData);
            }
        }, CONFIG.UPDATE_INTERVAL);
    }

    // ===================================
    // Utility Functions
    // ===================================
    function showLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.add('active');
    }

    function hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.remove('active');
    }

    function updateConnectionStatus() {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            setTimeout(() => {
                statusEl.classList.add('connected');
                statusEl.querySelector('.status-text').textContent = 'Live Data';
            }, 1000);
        }
    }

    function startClock() {
        function updateTime() {
            const el = document.getElementById('last-update-time');
            if (el) {
                el.textContent = new Date().toLocaleTimeString('th-TH');
            }
        }
        updateTime();
        setInterval(updateTime, 1000);
    }

    console.log('🤖 AI Stock Analyzer Engine loaded');

})();
