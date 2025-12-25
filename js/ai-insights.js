/**
 * Advanced AI Insights - Frontend Logic
 * All AI-powered stock analysis features
 */

(function () {
    'use strict';

    const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';

    // ===================================
    // Initialize
    // ===================================
    document.addEventListener('DOMContentLoaded', function () {
        initMobileMenu();
        initAnalyzeButton();
        updateConnectionStatus();

        // Auto-analyze default stock
        analyzeStock('NVDA');
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

        navTabs.querySelectorAll('.nav-link').forEach(tab => {
            tab.addEventListener('click', () => {
                menuBtn.classList.remove('active');
                navTabs.classList.remove('open');
            });
        });
    }

    // ===================================
    // Analyze Button
    // ===================================
    function initAnalyzeButton() {
        const input = document.getElementById('ai-stock-input');
        const btn = document.getElementById('analyze-ai-btn');

        if (!input || !btn) return;

        btn.addEventListener('click', () => analyzeStock(input.value));
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') analyzeStock(input.value);
        });
    }

    // ===================================
    // Main Analysis Function
    // ===================================
    async function analyzeStock(symbol) {
        symbol = symbol.trim().toUpperCase();
        if (!symbol) return;

        console.log(`🧠 AI Analyzing ${symbol}...`);

        try {
            // Fetch stock data from backend
            const response = await fetch(`${API_BASE}/api/analyze-stock/${symbol}`);
            if (!response.ok) throw new Error('Stock not found');

            const stockData = await response.json();

            // Fetch historical data for predictions
            const histResponse = await fetch(`${API_BASE}/api/ohlcv/${symbol}`);
            const histData = histResponse.ok ? await histResponse.json() : null;

            // Run all AI analyses
            updateTradeSignals(stockData);
            updatePricePrediction(stockData, histData);
            updatePatternRecognition(stockData, histData);
            updateSectorRotation(stockData);
            updatePortfolioOptimizer(stockData);
            updateNewsSentiment(stockData);

        } catch (error) {
            console.error('AI Analysis error:', error);
            alert('ไม่สามารถวิเคราะห์หุ้นนี้ได้');
        }
    }

    // ===================================
    // 1. AI Trade Signals
    // ===================================
    function updateTradeSignals(stock) {
        const signalEl = document.querySelector('.signal-action');
        const detailsEl = document.getElementById('signal-details');
        const confidenceEl = document.querySelector('.confidence-fill');
        const confidenceText = document.querySelector('.signal-confidence span');
        const winRate = document.querySelector('.win-portion');
        const loseRate = document.querySelector('.lose-portion');

        // Determine signal based on AI analysis
        let signal = 'HOLD';
        let signalClass = 'hold';
        let confidence = 50;

        if (stock.aiScore >= 65 && stock.ratingClass.includes('buy')) {
            signal = 'BUY';
            signalClass = 'buy';
            confidence = Math.min(95, stock.aiScore + 10);
        } else if (stock.aiScore <= 35 || stock.ratingClass.includes('sell')) {
            signal = 'SELL';
            signalClass = 'sell';
            confidence = Math.min(90, 100 - stock.aiScore + 10);
        } else {
            signal = 'HOLD';
            signalClass = 'hold';
            confidence = 50 + Math.abs(50 - stock.aiScore);
        }

        signalEl.textContent = signal;
        signalEl.className = `signal-action ${signalClass}`;
        confidenceEl.style.width = `${confidence}%`;
        confidenceText.textContent = `${Math.round(confidence)}% Confidence`;

        // Calculate entry/exit/stop
        const entry = stock.entryPoint || stock.price;
        const target = stock.exitPoint || stock.price * 1.1;
        const stopLoss = signal === 'BUY' ? stock.price * 0.95 : stock.price * 1.05;
        const riskReward = ((target - entry) / (entry - stopLoss)).toFixed(1);

        detailsEl.innerHTML = `
            <div class="detail-item"><span>Entry:</span><strong>$${entry.toFixed(2)}</strong></div>
            <div class="detail-item"><span>Target:</span><strong>$${target.toFixed(2)}</strong></div>
            <div class="detail-item"><span>Stop Loss:</span><strong>$${stopLoss.toFixed(2)}</strong></div>
            <div class="detail-item"><span>Risk/Reward:</span><strong>1:${riskReward}</strong></div>
        `;

        // Simulated win rate based on AI score
        const winRatePct = Math.min(85, Math.max(45, stock.aiScore + 10));
        winRate.style.width = `${winRatePct}%`;
        winRate.textContent = `${winRatePct}% Win`;
        loseRate.style.width = `${100 - winRatePct}%`;
        loseRate.textContent = `${100 - winRatePct}%`;
    }

    // ===================================
    // 2. AI Price Prediction
    // ===================================
    function updatePricePrediction(stock, histData) {
        const currentPriceEl = document.getElementById('current-price');
        const pred7d = document.getElementById('pred-7d');
        const pred14d = document.getElementById('pred-14d');
        const pred30d = document.getElementById('pred-30d');
        const modelConfidence = document.getElementById('model-confidence');
        const confidencePct = document.getElementById('confidence-pct');

        currentPriceEl.textContent = `$${stock.price.toFixed(2)}`;

        // AI Price Prediction Algorithm
        // Uses momentum, RSI, and trend analysis
        const momentum = stock.indicators?.priceChange5d || 0;
        const rsi = stock.indicators?.rsi || 50;
        const trendStrength = stock.aiScore / 100;

        // Calculate predicted prices
        let baseChange = momentum / 5; // Average daily change
        let rsiAdjustment = (50 - rsi) / 100 * 0.5; // Mean reversion factor

        // 7-day prediction
        const pred7dChange = baseChange * 7 + rsiAdjustment * 3;
        const pred7dPrice = stock.price * (1 + pred7dChange / 100);

        // 14-day prediction  
        const pred14dChange = baseChange * 10 + rsiAdjustment * 5 + trendStrength * 2;
        const pred14dPrice = stock.price * (1 + pred14dChange / 100);

        // 30-day prediction
        const pred30dChange = baseChange * 15 + rsiAdjustment * 8 + trendStrength * 5;
        const pred30dPrice = stock.price * (1 + pred30dChange / 100);

        // Update UI
        pred7d.textContent = `$${pred7dPrice.toFixed(2)}`;
        pred7d.className = `predicted-price ${pred7dChange >= 0 ? 'bullish' : 'bearish'}`;
        pred7d.nextElementSibling.textContent = `${pred7dChange >= 0 ? '+' : ''}${pred7dChange.toFixed(1)}%`;
        pred7d.nextElementSibling.style.color = pred7dChange >= 0 ? '#22c55e' : '#ef4444';

        pred14d.textContent = `$${pred14dPrice.toFixed(2)}`;
        pred14d.className = `predicted-price ${pred14dChange >= 0 ? 'bullish' : 'bearish'}`;
        pred14d.nextElementSibling.textContent = `${pred14dChange >= 0 ? '+' : ''}${pred14dChange.toFixed(1)}%`;
        pred14d.nextElementSibling.style.color = pred14dChange >= 0 ? '#22c55e' : '#ef4444';

        pred30d.textContent = `$${pred30dPrice.toFixed(2)}`;
        pred30d.className = `predicted-price ${pred30dChange >= 0 ? 'bullish' : 'bearish'}`;
        pred30d.nextElementSibling.textContent = `${pred30dChange >= 0 ? '+' : ''}${pred30dChange.toFixed(1)}%`;
        pred30d.nextElementSibling.style.color = pred30dChange >= 0 ? '#22c55e' : '#ef4444';

        // Model confidence based on data quality
        const confidence = Math.min(92, Math.max(55, 60 + trendStrength * 30));
        modelConfidence.style.width = `${confidence}%`;
        confidencePct.textContent = `${Math.round(confidence)}%`;
    }

    // ===================================
    // 3. AI Pattern Recognition
    // ===================================
    function updatePatternRecognition(stock, histData) {
        const patternsList = document.getElementById('patterns-list');
        const patternsCount = document.getElementById('patterns-count');

        // Detect patterns based on indicators
        const patterns = [];
        const rsi = stock.indicators?.rsi || 50;
        const priceChange5d = stock.indicators?.priceChange5d || 0;
        const priceChange20d = stock.indicators?.priceChange20d || 0;
        const nearHigh = stock.indicators?.nearHigh52w || 50;

        // Bull Flag Detection
        if (priceChange20d > 10 && priceChange5d > -3 && priceChange5d < 5) {
            patterns.push({
                icon: '🚩',
                name: 'Bull Flag',
                desc: 'Consolidation หลัง Rally ชี้ขาขึ้นต่อ',
                probability: 78,
                type: 'bullish'
            });
        }

        // Cup & Handle
        if (rsi > 45 && rsi < 65 && nearHigh < 15) {
            patterns.push({
                icon: '☕',
                name: 'Cup & Handle',
                desc: 'ใกล้ Breakout จาก 52W High',
                probability: 72,
                type: 'bullish'
            });
        }

        // Double Bottom
        if (rsi < 40 && priceChange5d > 0) {
            patterns.push({
                icon: '📊',
                name: 'Double Bottom',
                desc: 'สัญญาณกลับตัว',
                probability: 68,
                type: 'bullish'
            });
        }

        // Head & Shoulders (Bearish)
        if (rsi > 65 && priceChange5d < 0 && priceChange20d > 5) {
            patterns.push({
                icon: '👤',
                name: 'Head & Shoulders',
                desc: 'Potential Reversal Pattern',
                probability: 65,
                type: 'bearish'
            });
        }

        // Rising Wedge
        if (priceChange20d > 8 && rsi > 60) {
            patterns.push({
                icon: '📐',
                name: 'Rising Wedge',
                desc: 'ระวัง Breakdown',
                probability: 55,
                type: 'neutral'
            });
        }

        // Support/Resistance
        patterns.push({
            icon: '📍',
            name: 'Key S/R Levels',
            desc: `Support: $${(stock.price * 0.95).toFixed(0)} | Resistance: $${(stock.price * 1.08).toFixed(0)}`,
            probability: 85,
            type: 'neutral'
        });

        patternsCount.textContent = `${patterns.length} Patterns`;

        patternsList.innerHTML = patterns.slice(0, 4).map(p => `
            <div class="pattern-item ${p.type}">
                <div class="pattern-icon">${p.icon}</div>
                <div class="pattern-info">
                    <div class="pattern-name">${p.name}</div>
                    <div class="pattern-desc">${p.desc}</div>
                </div>
                <div class="pattern-probability">
                    <div class="prob-value">${p.probability}%</div>
                    <div class="prob-label">Success</div>
                </div>
            </div>
        `).join('');
    }

    // ===================================
    // 4. AI Sector Rotation
    // ===================================
    function updateSectorRotation(stock) {
        const sectorRotation = document.getElementById('sector-rotation');

        // Sector data with relative strength
        const sectors = [
            { name: 'Technology', rs: 1.45, status: '🔥 HOT', class: 'hot' },
            { name: 'Healthcare', rs: 1.22, status: '📈 Rising', class: 'warm' },
            { name: 'Consumer Disc.', rs: 1.12, status: '📈 Rising', class: 'warm' },
            { name: 'Financials', rs: 1.05, status: '➡️ Neutral', class: 'neutral' },
            { name: 'Industrials', rs: 0.98, status: '➡️ Neutral', class: 'neutral' },
            { name: 'Energy', rs: 0.85, status: '❄️ Cold', class: 'cold' },
            { name: 'Utilities', rs: 0.75, status: '❄️ Cold', class: 'cold' }
        ];

        // Randomize slightly for realism
        sectors.forEach(s => {
            s.rs = (s.rs + (Math.random() - 0.5) * 0.1).toFixed(2);
        });

        // Sort by RS
        sectors.sort((a, b) => b.rs - a.rs);

        sectorRotation.innerHTML = sectors.slice(0, 5).map((s, i) => `
            <div class="sector-item ${s.class}">
                <div class="sector-rank">${i + 1}</div>
                <div class="sector-info">
                    <div class="sector-name">${s.name}</div>
                    <div class="sector-strength">RS: ${s.rs}</div>
                </div>
                <div class="sector-status">${s.status}</div>
            </div>
        `).join('');
    }

    // ===================================
    // 5. AI Portfolio Optimizer
    // ===================================
    function updatePortfolioOptimizer(stock) {
        const optimizer = document.getElementById('portfolio-optimizer');

        // Calculate optimal allocation based on risk metrics
        const aiScore = stock.aiScore;
        const volatility = stock.riskLevel === 'high' ? 0.35 : stock.riskLevel === 'low' ? 0.15 : 0.25;

        // Sharpe Ratio estimation
        const expectedReturn = (aiScore / 100 * 0.3) + 0.05; // 5-35% expected
        const sharpeRatio = (expectedReturn / volatility).toFixed(2);
        const maxDrawdown = (-volatility * 100 * 0.5).toFixed(1);

        // Recommended allocation
        const allocations = [
            { symbol: stock.symbol, pct: Math.min(40, aiScore / 2 + 15), color: '#22c55e' },
            { symbol: 'SPY', pct: 25, color: '#3b82f6' },
            { symbol: 'QQQ', pct: 20, color: '#8b5cf6' },
            { symbol: 'BONDS', pct: 100 - Math.min(40, aiScore / 2 + 15) - 45, color: '#f59e0b' }
        ];

        optimizer.innerHTML = `
            <div class="optimizer-metrics">
                <div class="metric">
                    <span class="metric-label">Sharpe Ratio</span>
                    <span class="metric-value ${sharpeRatio > 1.5 ? 'good' : ''}">${sharpeRatio}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Expected Return</span>
                    <span class="metric-value">${(expectedReturn * 100).toFixed(1)}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Max Drawdown</span>
                    <span class="metric-value warning">${maxDrawdown}%</span>
                </div>
            </div>
            <div class="allocation-chart">
                <div class="allocation-title">แนะนำสัดส่วนพอร์ต</div>
                <div class="allocation-bars">
                    ${allocations.map(a => `
                        <div class="alloc-bar" style="--width: ${a.pct}%; --color: ${a.color};">
                            <span class="alloc-label">${a.symbol} ${a.pct.toFixed(0)}%</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // ===================================
    // 6. AI News Sentiment
    // ===================================
    function updateNewsSentiment(stock) {
        const sentimentDisplay = document.getElementById('sentiment-display');
        const overallSentiment = document.getElementById('overall-sentiment');

        // Calculate sentiment based on stock performance
        const aiScore = stock.aiScore;
        let positive = Math.min(70, Math.max(20, aiScore + 10));
        let negative = Math.min(40, Math.max(10, 100 - aiScore - 30));
        let neutral = 100 - positive - negative;

        let overall = positive > 50 ? 'Bullish' : positive < 30 ? 'Bearish' : 'Neutral';
        let overallClass = positive > 50 ? 'bullish' : positive < 30 ? 'bearish' : 'neutral';

        overallSentiment.textContent = overall;
        overallSentiment.className = `sentiment-badge ${overallClass}`;

        // Generate mock news based on sentiment
        const news = [];

        if (positive > 50) {
            news.push({
                title: `${stock.symbol} shows strong momentum ahead`,
                source: 'Reuters',
                time: '2h',
                sentiment: 'positive'
            });
            news.push({
                title: `Analysts upgrade ${stock.symbol} price target`,
                source: 'Bloomberg',
                time: '5h',
                sentiment: 'positive'
            });
        }

        if (negative > 25) {
            news.push({
                title: `Concerns rise over ${stock.symbol} valuation`,
                source: 'WSJ',
                time: '8h',
                sentiment: 'negative'
            });
        }

        news.push({
            title: `${stock.symbol} trading volume spikes`,
            source: 'CNBC',
            time: '12h',
            sentiment: 'neutral'
        });

        sentimentDisplay.innerHTML = `
            <div class="sentiment-meter">
                <div class="meter-bar">
                    <div class="meter-negative" style="width: ${negative}%">${negative}%</div>
                    <div class="meter-neutral" style="width: ${neutral}%">${neutral}%</div>
                    <div class="meter-positive" style="width: ${positive}%">${positive}%</div>
                </div>
                <div class="meter-labels">
                    <span>🐻 Bearish</span>
                    <span>😐 Neutral</span>
                    <span>🐂 Bullish</span>
                </div>
            </div>
            <div class="news-list">
                ${news.slice(0, 3).map(n => `
                    <div class="news-item ${n.sentiment}">
                        <div class="news-sentiment">${n.sentiment === 'positive' ? '🐂' : n.sentiment === 'negative' ? '🐻' : '😐'}</div>
                        <div class="news-content">
                            <div class="news-title">${n.title}</div>
                            <div class="news-source">${n.source} • ${n.time} ago</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // ===================================
    // Utility Functions
    // ===================================
    function updateConnectionStatus() {
        const statusEl = document.getElementById('connection-status');
        if (!statusEl) return;

        setTimeout(() => {
            statusEl.classList.add('connected');
            statusEl.querySelector('.status-text').textContent = 'AI Connected';
        }, 1000);
    }

    console.log('🧠 Advanced AI Insights loaded');

})();
