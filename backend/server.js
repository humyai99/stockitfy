/**
 * Stockify Backend Proxy Server
 * Real-time Stock Data from Yahoo Finance
 */

const express = require('express');
const cors = require('cors');
const yahooFinance = require('yahoo-finance2').default;
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// ===================================
// Cache for rate limiting
// ===================================
const cache = new Map();
const CACHE_DURATION = 60000; // 1 minute cache

function getCached(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    return null;
}

function setCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}

// ===================================
// API Routes
// ===================================

// Get stock quote
app.get('/api/quote/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const cacheKey = `quote_${symbol}`;

        // Check cache
        const cached = getCached(cacheKey);
        if (cached) {
            return res.json({ ...cached, fromCache: true });
        }

        console.log(`[API] Fetching quote for ${symbol}`);

        const quote = await yahooFinance.quote(symbol);

        const result = {
            symbol: quote.symbol,
            name: quote.longName || quote.shortName || symbol,
            price: quote.regularMarketPrice,
            change: quote.regularMarketChange,
            changePercent: quote.regularMarketChangePercent,
            high: quote.regularMarketDayHigh,
            low: quote.regularMarketDayLow,
            open: quote.regularMarketOpen,
            prevClose: quote.regularMarketPreviousClose,
            volume: quote.regularMarketVolume,
            marketCap: quote.marketCap,
            fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
            exchange: quote.exchange,
            currency: quote.currency,
            timestamp: Date.now()
        };

        setCache(cacheKey, result);
        res.json(result);

    } catch (error) {
        console.error(`[API] Error fetching quote:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get historical data
app.get('/api/history/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { period = '1y', interval = '1d' } = req.query;
        const cacheKey = `history_${symbol}_${period}_${interval}`;

        // Check cache
        const cached = getCached(cacheKey);
        if (cached) {
            return res.json({ data: cached, fromCache: true });
        }

        console.log(`[API] Fetching history for ${symbol} (${period})`);

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();

        switch (period) {
            case '1d': startDate.setDate(startDate.getDate() - 1); break;
            case '5d': startDate.setDate(startDate.getDate() - 5); break;
            case '1mo': startDate.setMonth(startDate.getMonth() - 1); break;
            case '3mo': startDate.setMonth(startDate.getMonth() - 3); break;
            case '6mo': startDate.setMonth(startDate.getMonth() - 6); break;
            case '1y': startDate.setFullYear(startDate.getFullYear() - 1); break;
            case '2y': startDate.setFullYear(startDate.getFullYear() - 2); break;
            case '5y': startDate.setFullYear(startDate.getFullYear() - 5); break;
            default: startDate.setFullYear(startDate.getFullYear() - 1);
        }

        const result = await yahooFinance.historical(symbol, {
            period1: startDate,
            period2: endDate,
            interval: interval
        });

        const formattedData = result.map(bar => ({
            date: bar.date.toISOString().split('T')[0],
            timestamp: bar.date.getTime() / 1000,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume
        }));

        setCache(cacheKey, formattedData);
        res.json({ data: formattedData });

    } catch (error) {
        console.error(`[API] Error fetching history:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// Search stocks
app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 1) {
            return res.json({ results: [] });
        }

        console.log(`[API] Searching for: ${q}`);

        const results = await yahooFinance.search(q, {
            quotesCount: 10,
            newsCount: 0
        });

        const formatted = (results.quotes || [])
            .filter(r => r.quoteType === 'EQUITY')
            .map(r => ({
                symbol: r.symbol,
                name: r.longname || r.shortname || r.symbol,
                exchange: r.exchange,
                type: r.quoteType
            }));

        res.json({ results: formatted });

    } catch (error) {
        console.error(`[API] Error searching:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get full analysis data (quote + history)
app.get('/api/analysis/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const cacheKey = `analysis_${symbol}`;

        // Check cache (shorter duration for analysis)
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 30000) { // 30 seconds cache
            return res.json({ ...cached.data, fromCache: true });
        }

        console.log(`[API] Full analysis for ${symbol}`);

        // Fetch quote and history in parallel
        const [quote, history] = await Promise.all([
            yahooFinance.quote(symbol),
            yahooFinance.historical(symbol, {
                period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
                period2: new Date(),
                interval: '1d'
            })
        ]);

        const result = {
            symbol: quote.symbol,
            name: quote.longName || quote.shortName || symbol,
            quote: {
                price: quote.regularMarketPrice,
                change: quote.regularMarketChange,
                changePercent: quote.regularMarketChangePercent,
                high: quote.regularMarketDayHigh,
                low: quote.regularMarketDayLow,
                open: quote.regularMarketOpen,
                prevClose: quote.regularMarketPreviousClose,
                volume: quote.regularMarketVolume,
                marketCap: quote.marketCap,
            },
            historical: history.map(bar => ({
                date: bar.date.toISOString().split('T')[0],
                timestamp: bar.date.getTime() / 1000,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                volume: bar.volume
            })),
            lastUpdated: Date.now()
        };

        cache.set(cacheKey, { data: result, timestamp: Date.now() });
        res.json(result);

    } catch (error) {
        console.error(`[API] Error in analysis:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime()
    });
});

// ===================================
// OHLCV Data with Technical Indicators
// ===================================
app.get('/api/ohlcv/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { period = '1y', interval = '1d' } = req.query;
        const cacheKey = `ohlcv_${symbol}_${period}_${interval}`;

        // Check cache
        const cached = getCached(cacheKey);
        if (cached) {
            return res.json({ ...cached, fromCache: true });
        }

        console.log(`[API] Fetching OHLCV for ${symbol} (${period}, ${interval})`);

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();

        switch (period) {
            case '1d': startDate.setDate(startDate.getDate() - 5); break; // Get 5 days for intraday
            case '1w': startDate.setDate(startDate.getDate() - 10); break;
            case '1mo': startDate.setMonth(startDate.getMonth() - 1); break;
            case '3mo': startDate.setMonth(startDate.getMonth() - 3); break;
            case '6mo': startDate.setMonth(startDate.getMonth() - 6); break;
            case '1y': startDate.setFullYear(startDate.getFullYear() - 1); break;
            case '2y': startDate.setFullYear(startDate.getFullYear() - 2); break;
            case '5y': startDate.setFullYear(startDate.getFullYear() - 5); break;
            default: startDate.setFullYear(startDate.getFullYear() - 1);
        }

        const history = await yahooFinance.historical(symbol, {
            period1: startDate,
            period2: endDate,
            interval: interval
        });

        // Format OHLCV data
        const ohlcv = history.map(bar => ({
            time: bar.date.toISOString().split('T')[0],
            timestamp: Math.floor(bar.date.getTime() / 1000),
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume
        }));

        // Calculate indicators
        const closes = history.map(h => h.close);

        // SMA calculations
        const sma20 = calculateSMAArray(closes, 20);
        const sma50 = calculateSMAArray(closes, 50);
        const sma200 = calculateSMAArray(closes, 200);

        // EMA calculations
        const ema9 = calculateEMAArray(closes, 9);
        const ema21 = calculateEMAArray(closes, 21);
        const ema50 = calculateEMAArray(closes, 50);

        // Bollinger Bands (20, 2)
        const bollingerBands = calculateBollingerBands(closes, 20, 2);

        // Attach indicators to data
        const dataWithIndicators = ohlcv.map((bar, i) => ({
            ...bar,
            sma20: sma20[i] || null,
            sma50: sma50[i] || null,
            sma200: sma200[i] || null,
            ema9: ema9[i] || null,
            ema21: ema21[i] || null,
            ema50: ema50[i] || null,
            bb_upper: bollingerBands.upper[i] || null,
            bb_middle: bollingerBands.middle[i] || null,
            bb_lower: bollingerBands.lower[i] || null
        }));

        const result = {
            symbol,
            period,
            interval,
            count: dataWithIndicators.length,
            data: dataWithIndicators,
            updated: Date.now()
        };

        setCache(cacheKey, result);
        res.json(result);

    } catch (error) {
        console.error(`[API] OHLCV error:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// Helper: Calculate SMA array
function calculateSMAArray(prices, period) {
    const result = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else {
            const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            result.push(Math.round((sum / period) * 100) / 100);
        }
    }
    return result;
}

// Helper: Calculate EMA array
function calculateEMAArray(prices, period) {
    const result = [];
    const k = 2 / (period + 1);

    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else if (i === period - 1) {
            const sma = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
            result.push(Math.round(sma * 100) / 100);
        } else {
            const ema = prices[i] * k + result[i - 1] * (1 - k);
            result.push(Math.round(ema * 100) / 100);
        }
    }
    return result;
}

// Helper: Calculate Bollinger Bands
function calculateBollingerBands(prices, period = 20, stdDev = 2) {
    const upper = [];
    const middle = [];
    const lower = [];

    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            upper.push(null);
            middle.push(null);
            lower.push(null);
        } else {
            const slice = prices.slice(i - period + 1, i + 1);
            const sma = slice.reduce((a, b) => a + b, 0) / period;
            const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
            const std = Math.sqrt(variance);

            middle.push(Math.round(sma * 100) / 100);
            upper.push(Math.round((sma + stdDev * std) * 100) / 100);
            lower.push(Math.round((sma - stdDev * std) * 100) / 100);
        }
    }

    return { upper, middle, lower };
}

// ===================================
// Technical Analysis Helpers
// ===================================
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function calculateSMA(prices, period) {
    if (prices.length < period) return prices[prices.length - 1] || 0;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateMACD(prices) {
    if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };

    // EMA calculation helper
    const calcEMA = (data, period) => {
        const k = 2 / (period + 1);
        let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < data.length; i++) {
            ema = data[i] * k + ema * (1 - k);
        }
        return ema;
    };

    const ema12 = calcEMA(prices, 12);
    const ema26 = calcEMA(prices, 26);
    const macd = ema12 - ema26;

    return { macd, signal: macd * 0.9, histogram: macd * 0.1 };
}

function calculateAIScore(rsi, macd, priceVsSMA50, priceVsSMA200, volumeTrend) {
    let score = 50; // Start neutral

    // RSI Score (25% weight)
    if (rsi < 30) score += 20; // Oversold = bullish
    else if (rsi < 50) score += 10;
    else if (rsi > 70) score -= 15; // Overbought = bearish
    else if (rsi > 60) score -= 5;

    // MACD Score (25% weight)
    if (macd.histogram > 0) score += 15;
    else score -= 10;

    // Price vs SMA50 (20% weight)
    if (priceVsSMA50 > 0) score += 12;
    else score -= 8;

    // Price vs SMA200 (20% weight)
    if (priceVsSMA200 > 0) score += 12;
    else score -= 8;

    // Volume trend (10% weight)
    if (volumeTrend > 1.1) score += 6;
    else if (volumeTrend < 0.9) score -= 4;

    return Math.max(0, Math.min(100, Math.round(score)));
}

function getRating(score) {
    if (score >= 80) return { rating: 'Strong Buy', class: 'strong-buy' };
    if (score >= 60) return { rating: 'Buy', class: 'buy' };
    if (score >= 40) return { rating: 'Hold', class: 'hold' };
    if (score >= 20) return { rating: 'Sell', class: 'sell' };
    return { rating: 'Strong Sell', class: 'strong-sell' };
}

// ===================================
// Stock Recommendations API
// ===================================
const TOP_STOCKS = ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AMD', 'NFLX', 'AVGO'];

app.get('/api/recommendations', async (req, res) => {
    try {
        const cacheKey = 'recommendations';
        const cached = getCached(cacheKey);
        if (cached) {
            return res.json({ ...cached, fromCache: true });
        }

        console.log('[API] Fetching stock recommendations...');

        const recommendations = await Promise.all(
            TOP_STOCKS.map(async (symbol) => {
                try {
                    // Fetch quote and history
                    const [quote, history] = await Promise.all([
                        yahooFinance.quote(symbol),
                        yahooFinance.historical(symbol, {
                            period1: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
                            period2: new Date(),
                            interval: '1d'
                        })
                    ]);

                    const closes = history.map(h => h.close);
                    const volumes = history.map(h => h.volume);

                    // Calculate indicators
                    const rsi = calculateRSI(closes);
                    const macd = calculateMACD(closes);
                    const sma20 = calculateSMA(closes, 20);
                    const sma50 = calculateSMA(closes, 50);
                    const sma200 = calculateSMA(closes, 200);
                    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
                    const volumeTrend = quote.regularMarketVolume / avgVolume;

                    // Calculate AI Score
                    const currentPrice = quote.regularMarketPrice;
                    const aiScore = calculateAIScore(
                        rsi,
                        macd,
                        currentPrice - sma50,
                        currentPrice - sma200,
                        volumeTrend
                    );
                    const { rating, class: ratingClass } = getRating(aiScore);

                    return {
                        symbol: quote.symbol,
                        name: quote.longName || quote.shortName || symbol,
                        price: currentPrice,
                        change: quote.regularMarketChange,
                        changePercent: quote.regularMarketChangePercent,
                        volume: quote.regularMarketVolume,
                        marketCap: quote.marketCap,
                        indicators: {
                            rsi: Math.round(rsi * 10) / 10,
                            macd: Math.round(macd.histogram * 100) / 100,
                            sma20: Math.round(sma20 * 100) / 100,
                            sma50: Math.round(sma50 * 100) / 100,
                            sma200: Math.round(sma200 * 100) / 100,
                            volumeTrend: Math.round(volumeTrend * 100) / 100
                        },
                        aiScore,
                        rating,
                        ratingClass,
                        timestamp: Date.now()
                    };
                } catch (e) {
                    console.error(`[API] Error analyzing ${symbol}:`, e.message);
                    return null;
                }
            })
        );

        const validRecs = recommendations.filter(r => r !== null);
        // Sort by AI Score descending
        validRecs.sort((a, b) => b.aiScore - a.aiScore);

        const result = {
            stocks: validRecs,
            updated: Date.now(),
            count: validRecs.length
        };

        setCache(cacheKey, result);
        res.json(result);

    } catch (error) {
        console.error('[API] Recommendations error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ===================================
// Enhanced AI Stock Picks API
// ===================================
const EXPANDED_STOCKS = [
    // Tech Giants
    'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AMD', 'NFLX', 'AVGO',
    // More Tech
    'CRM', 'ORCL', 'ADBE', 'INTC', 'QCOM', 'MU', 'AMAT', 'LRCX', 'ASML', 'SNPS',
    // Finance & Others
    'JPM', 'V', 'MA', 'BAC', 'GS'
];

// Fetch and analyze all stocks helper
async function analyzeAllStocks() {
    const cacheKey = 'analyzed_stocks';
    const cached = getCached(cacheKey);
    if (cached) return cached;

    console.log('[API] Analyzing all stocks...');

    const analyzed = await Promise.all(
        EXPANDED_STOCKS.map(async (symbol) => {
            try {
                const [quote, history] = await Promise.all([
                    yahooFinance.quote(symbol),
                    yahooFinance.historical(symbol, {
                        period1: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
                        period2: new Date(),
                        interval: '1d'
                    })
                ]);

                const closes = history.map(h => h.close);
                const volumes = history.map(h => h.volume);
                const highs = history.map(h => h.high);
                const lows = history.map(h => h.low);

                // Calculate indicators
                const rsi = calculateRSI(closes);
                const macd = calculateMACD(closes);
                const sma20 = calculateSMA(closes, 20);
                const sma50 = calculateSMA(closes, 50);
                const sma200 = calculateSMA(closes, 200);
                const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
                const currentVolume = volumes[volumes.length - 1] || avgVolume;
                const volumeRatio = currentVolume / avgVolume;

                // Price momentum (5-day change)
                const priceChange5d = ((closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6]) * 100;
                const priceChange20d = ((closes[closes.length - 1] - closes[closes.length - 21]) / closes[closes.length - 21]) * 100;

                // 52-week high proximity
                const high52w = quote.fiftyTwoWeekHigh || Math.max(...highs);
                const low52w = quote.fiftyTwoWeekLow || Math.min(...lows);
                const currentPrice = quote.regularMarketPrice;
                const nearHigh = ((high52w - currentPrice) / high52w) * 100;
                const nearLow = ((currentPrice - low52w) / low52w) * 100;

                // AI Score
                const priceVsSMA50 = ((currentPrice - sma50) / sma50) * 100;
                const priceVsSMA200 = ((currentPrice - sma200) / sma200) * 100;
                const volumeTrend = volumeRatio;

                const aiScore = calculateAIScore(rsi, macd, priceVsSMA50, priceVsSMA200, volumeTrend);
                const { rating, class: ratingClass } = getRating(aiScore);

                // Category determination with detailed analysis
                let category = 'neutral';
                let reason = '';
                let horizon = 'medium'; // short, medium, long
                let horizonThai = 'ระยะกลาง';
                let analysis = [];
                let entryPoint = null;
                let exitPoint = null;
                let riskLevel = 'medium';
                let recommendation = '';

                // Analyze trend direction
                const uptrend = currentPrice > sma50 && sma50 > sma200;
                const downtrend = currentPrice < sma50 && sma50 < sma200;

                // Calculate entry/exit points
                if (currentPrice > sma50) {
                    entryPoint = Math.round(sma50 * 100) / 100; // Entry at SMA50 support
                    exitPoint = Math.round(high52w * 0.95 * 100) / 100; // Exit near 52w high
                } else {
                    entryPoint = Math.round(low52w * 1.05 * 100) / 100; // Entry near 52w low
                    exitPoint = Math.round(sma50 * 100) / 100; // Exit at SMA50 resistance
                }

                // Momentum Stock: high volume + strong price action
                if (volumeRatio > 1.5 && priceChange5d > 3 && rsi > 50 && rsi < 75) {
                    category = 'momentum';
                    horizon = 'short';
                    horizonThai = 'ระยะสั้น (1-2 สัปดาห์)';
                    riskLevel = 'high';
                    reason = `🚀 หุ้นซิ่ง - Volume พุ่ง +${((volumeRatio - 1) * 100).toFixed(0)}%`;
                    recommendation = 'ซื้อเก็งกำไรระยะสั้น';
                    analysis = [
                        `📈 ราคาขึ้น +${priceChange5d.toFixed(1)}% ใน 5 วัน`,
                        `📊 Volume สูงกว่าปกติ ${volumeRatio.toFixed(1)} เท่า`,
                        `⚡ RSI ${rsi.toFixed(0)} ยังไม่ Overbought`,
                        `⚠️ ความเสี่ยงสูง เหมาะสำหรับเก็งกำไรระยะสั้น`,
                        `🎯 ควรตั้ง Stop Loss ที่ -5% ถึง -8%`
                    ];
                }
                // Value Pick: oversold + near 52w low
                else if (rsi < 35 && currentPrice < sma50 && nearLow < 20) {
                    category = 'value';
                    horizon = 'long';
                    horizonThai = 'ระยะยาว (3-6 เดือน)';
                    riskLevel = 'medium';
                    reason = `💎 หุ้น Oversold ใกล้จุดต่ำสุด 52 สัปดาห์`;
                    recommendation = 'สะสมเพื่อถือระยะยาว';
                    analysis = [
                        `📉 RSI ${rsi.toFixed(0)} อยู่ในโซน Oversold (< 30)`,
                        `💰 ราคาต่ำกว่า SMA50 มีโอกาสฟื้นตัว`,
                        `📊 ห่างจาก 52W Low เพียง ${nearLow.toFixed(1)}%`,
                        `✅ เหมาะสะสมทยอยซื้อ DCA`,
                        `⏳ อาจต้องรอ 1-3 เดือนก่อนเห็นผล`
                    ];
                }
                // Daily Pick: strong buy signals
                else if (aiScore >= 70 && macd.histogram > 0 && currentPrice > sma50) {
                    category = 'daily';
                    horizon = 'medium';
                    horizonThai = 'ระยะกลาง (1-3 เดือน)';
                    riskLevel = 'low';
                    reason = `🎯 สัญญาณซื้อแข็งแกร่ง`;
                    recommendation = uptrend ? 'ซื้อและถือระยะกลาง' : 'ซื้อรอจังหวะ';
                    analysis = [
                        `✅ AI Score ${aiScore}/100 สูงมาก`,
                        `📈 MACD Bullish - Histogram เป็นบวก`,
                        `💪 ราคาอยู่เหนือ SMA50 แนวโน้มขาขึ้น`,
                        uptrend ? `🔥 Uptrend ชัดเจน (ราคา > SMA50 > SMA200)` : `📊 กำลังสร้างแนวรับใหม่`,
                        `🎯 Target: $${exitPoint} (+${(((exitPoint / currentPrice) - 1) * 100).toFixed(1)}%)`
                    ];
                }
                // Watchout: overbought or weak
                else if (rsi > 72 || (aiScore < 35 && priceChange5d < -3)) {
                    category = 'watchout';
                    horizon = 'avoid';
                    horizonThai = 'หลีกเลี่ยง';
                    riskLevel = 'very-high';

                    if (rsi > 72) {
                        reason = `⚠️ Overbought - RSI ${rsi.toFixed(0)} สูงเกินไป`;
                        recommendation = 'รอปรับฐานก่อนเข้าซื้อ';
                        analysis = [
                            `🔴 RSI ${rsi.toFixed(0)} อยู่ในโซน Overbought (> 70)`,
                            `📉 มีโอกาสปรับฐาน 5-15%`,
                            `⏳ ควรรอ RSI ลงมาต่ำกว่า 50 ก่อน`,
                            `🎯 จุดเข้าซื้อที่ดี: $${entryPoint}`,
                            `❌ ไม่แนะนำซื้อที่ราคาปัจจุบัน`
                        ];
                    } else {
                        reason = `⚠️ Momentum อ่อนแอ`;
                        recommendation = 'ขายหรือหลีกเลี่ยง';
                        analysis = [
                            `🔴 AI Score ${aiScore} ต่ำมาก`,
                            `📉 ราคาลง ${priceChange5d.toFixed(1)}% ใน 5 วัน`,
                            downtrend ? `⬇️ Downtrend ชัด (ราคา < SMA50 < SMA200)` : `📊 แนวโน้มไม่ชัดเจน`,
                            `⚠️ ควรหลีกเลี่ยงจนกว่า Trend จะเปลี่ยน`,
                            `🛑 ถ้าถืออยู่ พิจารณาตั้ง Stop Loss`
                        ];
                    }
                }
                // Neutral / Hold
                else {
                    category = 'neutral';
                    horizon = 'hold';
                    horizonThai = 'ถือ/รอดู';
                    riskLevel = 'medium';
                    reason = `📊 สัญญาณยังไม่ชัดเจน`;
                    recommendation = 'รอสัญญาณที่ชัดเจนกว่านี้';
                    analysis = [
                        `📊 AI Score ${aiScore} อยู่ในโซนกลาง`,
                        `🔄 RSI ${rsi.toFixed(0)} เป็นกลาง`,
                        currentPrice > sma50 ? `✅ ราคาเหนือ SMA50` : `📉 ราคาต่ำกว่า SMA50`,
                        `⏳ รอสัญญาณ Breakout หรือ Breakdown`,
                        `📌 จับตาดูที่ $${sma50.toFixed(2)} (SMA50)`
                    ];
                }

                return {
                    symbol,
                    name: quote.shortName || quote.longName || symbol,
                    price: currentPrice,
                    change: quote.regularMarketChange,
                    changePercent: quote.regularMarketChangePercent,
                    marketCap: quote.marketCap,
                    volume: currentVolume,
                    avgVolume,
                    volumeRatio: Math.round(volumeRatio * 100) / 100,
                    indicators: {
                        rsi: Math.round(rsi * 10) / 10,
                        macdHistogram: Math.round(macd.histogram * 1000) / 1000,
                        sma50: Math.round(sma50 * 100) / 100,
                        sma200: Math.round(sma200 * 100) / 100,
                        priceChange5d: Math.round(priceChange5d * 100) / 100,
                        priceChange20d: Math.round(priceChange20d * 100) / 100,
                        nearHigh52w: Math.round(nearHigh * 100) / 100,
                    },
                    aiScore,
                    rating,
                    ratingClass,
                    category,
                    reason,
                    // New detailed analysis fields
                    horizon,
                    horizonThai,
                    recommendation,
                    analysis,
                    entryPoint,
                    exitPoint,
                    riskLevel,
                    timestamp: Date.now()
                };
            } catch (e) {
                console.error(`[API] Error analyzing ${symbol}:`, e.message);
                return null;
            }
        })
    );

    const result = analyzed.filter(s => s !== null);
    setCache(cacheKey, result);
    return result;
}

// ===================================
// Single Stock Analysis API
// ===================================
app.get('/api/analyze-stock/:symbol', async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        console.log(`[API] Analyzing single stock: ${symbol}`);

        // Fetch data
        const [quote, history] = await Promise.all([
            yahooFinance.quote(symbol),
            yahooFinance.historical(symbol, {
                period1: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
                period2: new Date(),
                interval: '1d'
            })
        ]);

        if (!quote || !history || history.length < 20) {
            return res.status(404).json({ error: 'ไม่พบข้อมูลหุ้นนี้' });
        }

        const closes = history.map(h => h.close);
        const volumes = history.map(h => h.volume);
        const highs = history.map(h => h.high);
        const lows = history.map(h => h.low);

        // Calculate indicators
        const rsi = calculateRSI(closes);
        const macd = calculateMACD(closes);
        const sma20 = calculateSMA(closes, 20);
        const sma50 = calculateSMA(closes, 50);
        const sma200 = calculateSMA(closes, 200);
        const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const currentVolume = volumes[volumes.length - 1] || avgVolume;
        const volumeRatio = currentVolume / avgVolume;

        const priceChange5d = ((closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6]) * 100;
        const priceChange20d = ((closes[closes.length - 1] - closes[closes.length - 21]) / closes[closes.length - 21]) * 100;

        const high52w = quote.fiftyTwoWeekHigh || Math.max(...highs);
        const low52w = quote.fiftyTwoWeekLow || Math.min(...lows);
        const currentPrice = quote.regularMarketPrice;
        const nearHigh = ((high52w - currentPrice) / high52w) * 100;
        const nearLow = ((currentPrice - low52w) / low52w) * 100;

        const priceVsSMA50 = ((currentPrice - sma50) / sma50) * 100;
        const priceVsSMA200 = ((currentPrice - sma200) / sma200) * 100;
        const volumeTrend = volumeRatio;

        const aiScore = calculateAIScore(rsi, macd, priceVsSMA50, priceVsSMA200, volumeTrend);
        const { rating, class: ratingClass } = getRating(aiScore);

        // Analysis with horizon
        let category = 'neutral';
        let horizon = 'medium';
        let horizonThai = 'ระยะกลาง';
        let analysis = [];
        let entryPoint = null;
        let exitPoint = null;
        let riskLevel = 'medium';
        let recommendation = '';
        let reason = '';

        const uptrend = currentPrice > sma50 && sma50 > sma200;
        const downtrend = currentPrice < sma50 && sma50 < sma200;

        if (currentPrice > sma50) {
            entryPoint = Math.round(sma50 * 100) / 100;
            exitPoint = Math.round(high52w * 0.95 * 100) / 100;
        } else {
            entryPoint = Math.round(low52w * 1.05 * 100) / 100;
            exitPoint = Math.round(sma50 * 100) / 100;
        }

        // Determine category and analysis
        if (volumeRatio > 1.5 && priceChange5d > 3 && rsi > 50 && rsi < 75) {
            category = 'momentum';
            horizon = 'short';
            horizonThai = 'ระยะสั้น (1-2 สัปดาห์)';
            riskLevel = 'high';
            reason = `🚀 หุ้นซิ่ง - Volume พุ่ง +${((volumeRatio - 1) * 100).toFixed(0)}%`;
            recommendation = 'ซื้อเก็งกำไรระยะสั้น';
            analysis = [
                `📈 ราคาขึ้น +${priceChange5d.toFixed(1)}% ใน 5 วัน`,
                `📊 Volume สูงกว่าปกติ ${volumeRatio.toFixed(1)} เท่า`,
                `⚡ RSI ${rsi.toFixed(0)} ยังไม่ Overbought`,
                `⚠️ ความเสี่ยงสูง เหมาะสำหรับเก็งกำไรระยะสั้น`,
                `🎯 ควรตั้ง Stop Loss ที่ -5% ถึง -8%`
            ];
        } else if (rsi < 35 && currentPrice < sma50) {
            category = 'value';
            horizon = 'long';
            horizonThai = 'ระยะยาว (3-6 เดือน)';
            riskLevel = 'medium';
            reason = `💎 หุ้น Oversold น่าสะสม`;
            recommendation = 'สะสมเพื่อถือระยะยาว';
            analysis = [
                `📉 RSI ${rsi.toFixed(0)} อยู่ในโซน Oversold (< 35)`,
                `💰 ราคาต่ำกว่า SMA50 มีโอกาสฟื้นตัว`,
                `📊 ห่างจาก 52W Low ${nearLow.toFixed(1)}%`,
                `✅ เหมาะสะสมทยอยซื้อ DCA`,
                `⏳ อาจต้องรอ 1-3 เดือนก่อนเห็นผล`
            ];
        } else if (aiScore >= 65 && macd.histogram > 0 && currentPrice > sma50) {
            category = 'daily';
            horizon = 'medium';
            horizonThai = 'ระยะกลาง (1-3 เดือน)';
            riskLevel = 'low';
            reason = `🎯 สัญญาณซื้อแข็งแกร่ง`;
            recommendation = uptrend ? 'ซื้อและถือระยะกลาง' : 'ซื้อรอจังหวะ';
            analysis = [
                `✅ AI Score ${aiScore}/100 สูง`,
                `📈 MACD Bullish - Histogram เป็นบวก`,
                `💪 ราคาอยู่เหนือ SMA50 แนวโน้มขาขึ้น`,
                uptrend ? `🔥 Uptrend ชัดเจน` : `📊 กำลังสร้างแนวรับใหม่`,
                `🎯 Target: $${exitPoint} (+${(((exitPoint / currentPrice) - 1) * 100).toFixed(1)}%)`
            ];
        } else if (rsi > 70 || aiScore < 35) {
            category = 'watchout';
            horizon = 'avoid';
            horizonThai = 'หลีกเลี่ยง';
            riskLevel = 'very-high';
            reason = rsi > 70 ? `⚠️ Overbought - RSI ${rsi.toFixed(0)}` : `⚠️ สัญญาณอ่อนแอ`;
            recommendation = rsi > 70 ? 'รอปรับฐานก่อนเข้าซื้อ' : 'หลีกเลี่ยง';
            analysis = rsi > 70 ? [
                `🔴 RSI ${rsi.toFixed(0)} อยู่ในโซน Overbought`,
                `📉 มีโอกาสปรับฐาน 5-15%`,
                `⏳ ควรรอ RSI ลงมาต่ำกว่า 50`,
                `🎯 จุดเข้าซื้อที่ดี: $${entryPoint}`,
                `❌ ไม่แนะนำซื้อตอนนี้`
            ] : [
                `🔴 AI Score ${aiScore} ต่ำ`,
                `📉 แนวโน้มอ่อนแอ`,
                downtrend ? `⬇️ Downtrend` : `📊 ไม่มีทิศทางชัด`,
                `⚠️ ควรหลีกเลี่ยง`,
                `🛑 พิจารณา Stop Loss`
            ];
        } else {
            category = 'neutral';
            horizon = 'hold';
            horizonThai = 'ถือ/รอดู';
            riskLevel = 'medium';
            reason = `📊 สัญญาณยังไม่ชัดเจน`;
            recommendation = 'รอสัญญาณที่ชัดเจนกว่านี้';
            analysis = [
                `📊 AI Score ${aiScore} อยู่ในโซนกลาง`,
                `🔄 RSI ${rsi.toFixed(0)} เป็นกลาง`,
                currentPrice > sma50 ? `✅ ราคาเหนือ SMA50` : `📉 ราคาต่ำกว่า SMA50`,
                `⏳ รอสัญญาณ Breakout หรือ Breakdown`,
                `📌 จับตาที่ $${sma50.toFixed(2)} (SMA50)`
            ];
        }

        res.json({
            symbol,
            name: quote.shortName || quote.longName || symbol,
            price: currentPrice,
            change: quote.regularMarketChange,
            changePercent: quote.regularMarketChangePercent,
            marketCap: quote.marketCap,
            volume: currentVolume,
            avgVolume,
            volumeRatio: Math.round(volumeRatio * 100) / 100,
            indicators: {
                rsi: Math.round(rsi * 10) / 10,
                macdHistogram: Math.round(macd.histogram * 1000) / 1000,
                sma50: Math.round(sma50 * 100) / 100,
                sma200: Math.round(sma200 * 100) / 100,
                priceChange5d: Math.round(priceChange5d * 100) / 100,
                priceChange20d: Math.round(priceChange20d * 100) / 100,
                nearHigh52w: Math.round(nearHigh * 100) / 100,
            },
            aiScore,
            rating,
            ratingClass,
            category,
            reason,
            horizon,
            horizonThai,
            recommendation,
            analysis,
            entryPoint,
            exitPoint,
            riskLevel,
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('[API] Analyze stock error:', error.message);
        res.status(500).json({ error: 'ไม่สามารถวิเคราะห์หุ้นได้: ' + error.message });
    }
});

// Daily Picks - Top AI-recommended stocks
app.get('/api/daily-picks', async (req, res) => {
    try {
        const allStocks = await analyzeAllStocks();

        // Get stocks with high AI scores or marked as 'daily'
        const dailyPicks = allStocks
            .filter(s => s.category === 'daily' || s.aiScore >= 65)
            .sort((a, b) => b.aiScore - a.aiScore)
            .slice(0, 5);

        res.json({
            picks: dailyPicks,
            updated: Date.now(),
            title: '🎯 AI Daily Picks',
            description: 'หุ้นที่ AI แนะนำให้ซื้อวันนี้'
        });
    } catch (error) {
        console.error('[API] Daily picks error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Momentum Stocks - หุ้นซิ่ง
app.get('/api/momentum-stocks', async (req, res) => {
    try {
        const allStocks = await analyzeAllStocks();

        // Get stocks with high momentum
        const momentum = allStocks
            .filter(s => s.category === 'momentum' || (s.volumeRatio > 1.3 && s.indicators.priceChange5d > 2))
            .sort((a, b) => b.volumeRatio - a.volumeRatio)
            .slice(0, 5);

        res.json({
            picks: momentum,
            updated: Date.now(),
            title: '🚀 หุ้นซิ่ง',
            description: 'หุ้นที่มี Volume และ Momentum สูง'
        });
    } catch (error) {
        console.error('[API] Momentum error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Value Picks - หุ้น Oversold / PE ต่ำ
app.get('/api/value-picks', async (req, res) => {
    try {
        const allStocks = await analyzeAllStocks();

        // Get oversold or undervalued stocks
        const valuePicks = allStocks
            .filter(s => s.category === 'value' || s.indicators.rsi < 40)
            .sort((a, b) => a.indicators.rsi - b.indicators.rsi)
            .slice(0, 5);

        res.json({
            picks: valuePicks,
            updated: Date.now(),
            title: '💎 Value Picks',
            description: 'หุ้น Oversold ที่น่าจับตา'
        });
    } catch (error) {
        console.error('[API] Value picks error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Watchout - หุ้นควรระวัง
app.get('/api/watchout', async (req, res) => {
    try {
        const allStocks = await analyzeAllStocks();

        // Get overbought or risky stocks
        const watchout = allStocks
            .filter(s => s.category === 'watchout' || s.indicators.rsi > 70 || s.aiScore < 30)
            .sort((a, b) => b.indicators.rsi - a.indicators.rsi)
            .slice(0, 5);

        res.json({
            picks: watchout,
            updated: Date.now(),
            title: '⚠️ ควรระวัง',
            description: 'หุ้นที่มีสัญญาณเตือน'
        });
    } catch (error) {
        console.error('[API] Watchout error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// All Categories Combined
app.get('/api/stock-picks', async (req, res) => {
    try {
        const allStocks = await analyzeAllStocks();

        const dailyPicks = allStocks.filter(s => s.category === 'daily' || s.aiScore >= 65).sort((a, b) => b.aiScore - a.aiScore).slice(0, 5);
        const momentum = allStocks.filter(s => s.category === 'momentum' || (s.volumeRatio > 1.3 && s.indicators.priceChange5d > 2)).sort((a, b) => b.volumeRatio - a.volumeRatio).slice(0, 5);
        const valuePicks = allStocks.filter(s => s.category === 'value' || s.indicators.rsi < 40).sort((a, b) => a.indicators.rsi - b.indicators.rsi).slice(0, 5);
        const watchout = allStocks.filter(s => s.category === 'watchout' || s.indicators.rsi > 70 || s.aiScore < 30).sort((a, b) => b.indicators.rsi - a.indicators.rsi).slice(0, 5);

        res.json({
            dailyPicks: { picks: dailyPicks, title: '🎯 AI Daily Picks', description: 'หุ้นที่ AI แนะนำให้ซื้อวันนี้' },
            momentum: { picks: momentum, title: '🚀 หุ้นซิ่ง', description: 'หุ้นที่มี Volume และ Momentum สูง' },
            valuePicks: { picks: valuePicks, title: '💎 Value Picks', description: 'หุ้น Oversold ที่น่าจับตา' },
            watchout: { picks: watchout, title: '⚠️ ควรระวัง', description: 'หุ้นที่มีสัญญาณเตือน' },
            marketMood: getMarketMood(allStocks),
            updated: Date.now()
        });
    } catch (error) {
        console.error('[API] Stock picks error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

function getMarketMood(stocks) {
    const avgScore = stocks.reduce((sum, s) => sum + s.aiScore, 0) / stocks.length;
    const bullish = stocks.filter(s => s.aiScore >= 60).length;
    const bearish = stocks.filter(s => s.aiScore < 40).length;

    let mood = 'neutral';
    let emoji = '😐';
    let message = 'ตลาดเคลื่อนไหวในกรอบ';

    if (avgScore >= 60 && bullish > bearish * 2) {
        mood = 'bullish';
        emoji = '🐂';
        message = 'ตลาดมีแนวโน้ม Bullish';
    } else if (avgScore < 45 && bearish > bullish * 2) {
        mood = 'bearish';
        emoji = '🐻';
        message = 'ตลาดมีแนวโน้ม Bearish ควรระวัง';
    }

    return { mood, emoji, message, avgScore: Math.round(avgScore), bullish, bearish, total: stocks.length };
}

// ===================================
// Live Indices API
// ===================================
const INDICES = [
    { symbol: '^GSPC', id: 'spy', name: 'S&P 500' },
    { symbol: '^NDX', id: 'qqq', name: 'Nasdaq 100' },
    { symbol: '^N225', id: 'nky', name: 'Nikkei 225' },
    { symbol: '^STOXX50E', id: 'stoxx', name: 'Euro Stoxx 50' },
    { symbol: '^SET.BK', id: 'set', name: 'SET Index' },
    { symbol: '^VIX', id: 'vix', name: 'VIX' }
];

app.get('/api/indices', async (req, res) => {
    try {
        const cacheKey = 'indices';
        const cached = getCached(cacheKey);
        if (cached) {
            return res.json({ ...cached, fromCache: true });
        }

        console.log('[API] Fetching live indices...');

        const indices = await Promise.all(
            INDICES.map(async (idx) => {
                try {
                    const quote = await yahooFinance.quote(idx.symbol);
                    return {
                        id: idx.id,
                        symbol: idx.symbol,
                        name: idx.name,
                        price: quote.regularMarketPrice,
                        change: quote.regularMarketChange,
                        changePercent: quote.regularMarketChangePercent,
                        high: quote.regularMarketDayHigh,
                        low: quote.regularMarketDayLow,
                        prevClose: quote.regularMarketPreviousClose,
                        timestamp: Date.now()
                    };
                } catch (e) {
                    console.error(`[API] Error fetching ${idx.symbol}:`, e.message);
                    return null;
                }
            })
        );

        const result = {
            indices: indices.filter(i => i !== null),
            updated: Date.now()
        };

        setCache(cacheKey, result);
        res.json(result);

    } catch (error) {
        console.error('[API] Indices error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ===================================
// WebSocket Server for Real-time Updates
// ===================================
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// Store active subscriptions
const subscriptions = new Map();

wss.on('connection', (ws) => {
    console.log('[WS] Client connected');
    const clientId = Date.now().toString();
    subscriptions.set(clientId, { ws, symbols: new Set() });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.action === 'subscribe') {
                const sub = subscriptions.get(clientId);
                if (sub) {
                    sub.symbols.add(data.symbol.toUpperCase());
                    console.log(`[WS] ${clientId} subscribed to ${data.symbol}`);
                }
            }

            if (data.action === 'unsubscribe') {
                const sub = subscriptions.get(clientId);
                if (sub) {
                    sub.symbols.delete(data.symbol.toUpperCase());
                }
            }
        } catch (e) {
            console.error('[WS] Invalid message:', e.message);
        }
    });

    ws.on('close', () => {
        console.log('[WS] Client disconnected');
        subscriptions.delete(clientId);
    });

    // Send initial connection confirmation
    ws.send(JSON.stringify({ type: 'connected', clientId }));
});

// Broadcast price updates every 10 seconds
async function broadcastPrices() {
    const allSymbols = new Set();

    subscriptions.forEach((sub) => {
        sub.symbols.forEach(s => allSymbols.add(s));
    });

    if (allSymbols.size === 0) return;

    try {
        const symbols = Array.from(allSymbols);
        console.log(`[WS] Broadcasting prices for: ${symbols.join(', ')}`);

        const quotes = await Promise.all(
            symbols.map(async (symbol) => {
                try {
                    const quote = await yahooFinance.quote(symbol);
                    return {
                        symbol: quote.symbol,
                        price: quote.regularMarketPrice,
                        change: quote.regularMarketChange,
                        changePercent: quote.regularMarketChangePercent,
                        high: quote.regularMarketDayHigh,
                        low: quote.regularMarketDayLow,
                        volume: quote.regularMarketVolume,
                        timestamp: Date.now()
                    };
                } catch (e) {
                    console.error(`[WS] Error fetching ${symbol}:`, e.message);
                    return null;
                }
            })
        );

        const validQuotes = quotes.filter(q => q !== null);

        subscriptions.forEach((sub) => {
            if (sub.ws.readyState === WebSocket.OPEN) {
                const clientQuotes = validQuotes.filter(q => sub.symbols.has(q.symbol));
                if (clientQuotes.length > 0) {
                    sub.ws.send(JSON.stringify({
                        type: 'quotes',
                        data: clientQuotes
                    }));
                }
            }
        });

    } catch (error) {
        console.error('[WS] Broadcast error:', error.message);
    }
}

// ===================================
// Real-time Options Flow API
// ===================================
const OPTIONS_SYMBOLS = ['AAPL', 'NVDA', 'TSLA', 'AMD', 'META', 'AMZN', 'GOOGL', 'MSFT', 'SPY', 'QQQ'];

// Get options chain for a single symbol
app.get('/api/options/:symbol', async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        const cacheKey = `options_${symbol}`;

        const cached = getCached(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        console.log(`[API] Fetching options for ${symbol}`);

        // Get options chain from Yahoo Finance
        const options = await yahooFinance.options(symbol);

        if (!options || !options.options || options.options.length === 0) {
            return res.status(404).json({ error: 'ไม่พบข้อมูล Options' });
        }

        const currentPrice = options.quote?.regularMarketPrice || 0;
        const expirationDates = options.expirationDates || [];
        const optionsData = options.options[0]; // First expiration

        // Process calls and puts
        const processContracts = (contracts, type) => {
            return (contracts || []).map(c => ({
                symbol,
                type,
                strike: c.strike,
                lastPrice: c.lastPrice || 0,
                change: c.change || 0,
                volume: c.volume || 0,
                openInterest: c.openInterest || 0,
                impliedVolatility: c.impliedVolatility || 0,
                inTheMoney: c.inTheMoney,
                expiry: optionsData.expirationDate ?
                    new Date(optionsData.expirationDate * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-',
                // Unusual activity: volume > open interest * 0.5
                unusual: c.volume > (c.openInterest || 1) * 0.5 && c.volume > 1000
            }));
        };

        const calls = processContracts(optionsData.calls, 'CALL');
        const puts = processContracts(optionsData.puts, 'PUT');

        const result = {
            symbol,
            currentPrice,
            expirationDates: expirationDates.slice(0, 5),
            calls: calls.sort((a, b) => b.volume - a.volume).slice(0, 20),
            puts: puts.sort((a, b) => b.volume - a.volume).slice(0, 20),
            totalCallVolume: calls.reduce((sum, c) => sum + c.volume, 0),
            totalPutVolume: puts.reduce((sum, c) => sum + c.volume, 0),
            putCallRatio: calls.reduce((sum, c) => sum + c.volume, 0) > 0
                ? (puts.reduce((sum, c) => sum + c.volume, 0) / calls.reduce((sum, c) => sum + c.volume, 0)).toFixed(2)
                : 0,
            timestamp: Date.now()
        };

        setCache(cacheKey, result);
        res.json(result);

    } catch (error) {
        console.error('[API] Options error:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูล Options ได้' });
    }
});

// Get aggregated options flow from multiple symbols
app.get('/api/options-flow', async (req, res) => {
    try {
        const cacheKey = 'options_flow_all';
        const cached = getCached(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        console.log('[API] Fetching real-time options flow...');

        // Fetch options for all symbols
        const optionsPromises = OPTIONS_SYMBOLS.map(async (symbol) => {
            try {
                const options = await yahooFinance.options(symbol);
                if (!options || !options.options || options.options.length === 0) return null;

                const optionsData = options.options[0];
                const currentPrice = options.quote?.regularMarketPrice || 0;

                const processUnusual = (contracts, type) => {
                    return (contracts || [])
                        .filter(c => c.volume > (c.openInterest || 1) * 0.3 && c.volume > 500)
                        .map(c => ({
                            symbol,
                            type,
                            strike: c.strike,
                            expiry: optionsData.expirationDate ?
                                new Date(optionsData.expirationDate * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-',
                            volume: c.volume || 0,
                            openInterest: c.openInterest || 0,
                            premium: ((c.lastPrice || 0) * (c.volume || 0) * 100 / 1000000).toFixed(2), // in millions
                            iv: (c.impliedVolatility * 100).toFixed(1) + '%',
                            signal: type === 'CALL' && c.volume > 5000 ? 'bullish' :
                                type === 'PUT' && c.volume > 5000 ? 'bearish' : 'neutral',
                            currentPrice
                        }));
                };

                const unusualCalls = processUnusual(optionsData.calls, 'CALL');
                const unusualPuts = processUnusual(optionsData.puts, 'PUT');

                return {
                    symbol,
                    callVolume: (optionsData.calls || []).reduce((sum, c) => sum + (c.volume || 0), 0),
                    putVolume: (optionsData.puts || []).reduce((sum, c) => sum + (c.volume || 0), 0),
                    unusual: [...unusualCalls, ...unusualPuts]
                };
            } catch {
                return null;
            }
        });

        const results = await Promise.all(optionsPromises);
        const validResults = results.filter(r => r !== null);

        // Aggregate data
        let totalCallVolume = 0;
        let totalPutVolume = 0;
        let allUnusual = [];

        validResults.forEach(r => {
            totalCallVolume += r.callVolume;
            totalPutVolume += r.putVolume;
            allUnusual = allUnusual.concat(r.unusual);
        });

        // Sort unusual by volume and take top 15
        allUnusual = allUnusual.sort((a, b) => b.volume - a.volume).slice(0, 15);

        const putCallRatio = totalCallVolume > 0 ? (totalPutVolume / totalCallVolume).toFixed(2) : 0;
        const mood = putCallRatio < 0.7 ? 'Bullish 🐂' : putCallRatio > 1.0 ? 'Bearish 🐻' : 'Neutral 😐';

        const result = {
            bullishFlow: Math.round(totalCallVolume * 0.01), // Estimate in millions
            bearishFlow: Math.round(totalPutVolume * 0.01),
            putCallRatio,
            mood,
            unusualActivity: allUnusual,
            symbolsAnalyzed: OPTIONS_SYMBOLS,
            timestamp: Date.now()
        };

        setCache(cacheKey, result);
        res.json(result);

    } catch (error) {
        console.error('[API] Options flow error:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูล Options Flow ได้' });
    }
});

// ===================================
// Stock Screener API
// ===================================
const SCREENER_SYMBOLS = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B', 'JPM', 'V',
    'JNJ', 'WMT', 'MA', 'PG', 'UNH', 'HD', 'DIS', 'NFLX', 'AMD', 'CRM',
    'INTC', 'CSCO', 'VZ', 'KO', 'PEP', 'XOM', 'CVX', 'BA', 'NKE', 'MCD'
];

app.get('/api/screener', async (req, res) => {
    try {
        console.log('[API] Fetching screener data...');

        const cacheKey = 'screener_data';
        const cached = getCached(cacheKey);
        if (cached) {
            return res.json({ stocks: cached, source: 'cache' });
        }

        const stocks = [];

        for (const symbol of SCREENER_SYMBOLS) {
            try {
                const quote = await yahooFinance.quote(symbol);

                // Calculate RSI (simplified)
                let rsi = 50;
                const changePercent = quote.regularMarketChangePercent || 0;
                if (changePercent > 0) {
                    rsi = Math.min(70 + changePercent * 2, 95);
                } else {
                    rsi = Math.max(30 + changePercent * 2, 5);
                }

                // Calculate AI Score
                const momentum = changePercent > 0 ? 15 : -10;
                const rsiScore = rsi < 30 ? 20 : rsi > 70 ? -15 : 5;
                const volumeScore = quote.regularMarketVolume > 50000000 ? 10 : 0;
                const aiScore = Math.min(100, Math.max(0, 50 + momentum + rsiScore + volumeScore));

                stocks.push({
                    symbol: quote.symbol,
                    name: quote.shortName || quote.longName || symbol,
                    price: quote.regularMarketPrice,
                    change: quote.regularMarketChange,
                    changePercent: quote.regularMarketChangePercent,
                    volume: quote.regularMarketVolume,
                    marketCap: quote.marketCap,
                    pe: quote.trailingPE,
                    rsi: rsi,
                    aiScore: Math.round(aiScore)
                });
            } catch (e) {
                console.log(`[Screener] Skip ${symbol}:`, e.message);
            }
        }

        setCache(cacheKey, stocks);
        res.json({ stocks, source: 'api' });

    } catch (error) {
        console.error('[API] Screener error:', error.message);
        res.status(500).json({ error: 'Failed to fetch screener data' });
    }
});

// ===================================
// Earnings Calendar API
// ===================================
app.get('/api/earnings', async (req, res) => {
    try {
        console.log('[API] Fetching earnings calendar...');

        const cacheKey = 'earnings_data';
        const cached = getCached(cacheKey);
        if (cached) {
            return res.json({ earnings: cached, source: 'cache' });
        }

        const earningsData = [];
        const now = new Date();

        for (const symbol of SCREENER_SYMBOLS.slice(0, 15)) {
            try {
                const quoteSummary = await yahooFinance.quoteSummary(symbol, {
                    modules: ['calendarEvents', 'earnings', 'price']
                });

                const calendar = quoteSummary.calendarEvents;
                const earnings = quoteSummary.earnings;
                const price = quoteSummary.price;

                if (calendar?.earnings?.earningsDate?.[0]) {
                    const earningsDate = new Date(calendar.earnings.earningsDate[0]);

                    earningsData.push({
                        symbol: symbol,
                        name: price?.shortName || symbol,
                        date: earningsDate.toISOString().split('T')[0],
                        time: calendar.earnings.earningsDateEnd ? 'Before' : 'After',
                        epsEstimate: earnings?.earningsChart?.currentQuarterEstimate || null,
                        revenue: calendar.earnings.revenue?.avg || null,
                        daysUntil: Math.ceil((earningsDate - now) / (1000 * 60 * 60 * 24))
                    });
                }
            } catch (e) {
                // Skip if no earnings data available
            }
        }

        // Sort by date
        earningsData.sort((a, b) => new Date(a.date) - new Date(b.date));

        setCache(cacheKey, earningsData);
        res.json({ earnings: earningsData, source: 'api' });

    } catch (error) {
        console.error('[API] Earnings error:', error.message);
        res.status(500).json({ error: 'Failed to fetch earnings data' });
    }
});

// ===================================
// News Feed API
// ===================================
app.get('/api/news/:symbol?', async (req, res) => {
    try {
        const symbol = req.params.symbol || 'AAPL';
        console.log(`[API] Fetching news for ${symbol}...`);

        const cacheKey = `news_${symbol}`;
        const cached = getCached(cacheKey);
        if (cached) {
            return res.json({ news: cached, source: 'cache' });
        }

        const searchResult = await yahooFinance.search(symbol, {
            newsCount: 10
        });

        const news = (searchResult.news || []).map(item => {
            // Simple sentiment analysis based on title keywords
            let sentiment = 'neutral';
            const title = (item.title || '').toLowerCase();

            const bullishWords = ['surge', 'soar', 'jump', 'gain', 'rise', 'up', 'bull', 'beat', 'strong', 'growth', 'profit'];
            const bearishWords = ['fall', 'drop', 'crash', 'decline', 'down', 'bear', 'miss', 'weak', 'loss', 'concern'];

            const bullishCount = bullishWords.filter(w => title.includes(w)).length;
            const bearishCount = bearishWords.filter(w => title.includes(w)).length;

            if (bullishCount > bearishCount) sentiment = 'positive';
            else if (bearishCount > bullishCount) sentiment = 'negative';

            return {
                title: item.title,
                link: item.link,
                publisher: item.publisher,
                publishedAt: item.providerPublishTime,
                thumbnail: item.thumbnail?.resolutions?.[0]?.url || null,
                sentiment: sentiment
            };
        });

        setCache(cacheKey, news);
        res.json({ news, symbol, source: 'api' });

    } catch (error) {
        console.error('[API] News error:', error.message);
        res.status(500).json({ error: 'Failed to fetch news' });
    }
});

// ===================================
// AI Chatbot with OpenAI GPT
// ===================================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, stockContext } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        console.log('[Chat] User:', message);

        // Fetch stock data if a symbol is mentioned
        let stockData = null;
        const symbolMatch = message.match(/\b([A-Z]{1,5})\b/);
        if (symbolMatch) {
            const symbol = symbolMatch[1];
            if (['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA', 'META', 'AMZN', 'AMD', 'JPM', 'V', 'SPY', 'QQQ'].includes(symbol)) {
                try {
                    const quote = await yahooFinance.quote(symbol);
                    stockData = {
                        symbol: quote.symbol,
                        price: quote.regularMarketPrice,
                        change: quote.regularMarketChange,
                        changePercent: quote.regularMarketChangePercent,
                        high: quote.regularMarketDayHigh,
                        low: quote.regularMarketDayLow,
                        volume: quote.regularMarketVolume,
                        marketCap: quote.marketCap,
                        pe: quote.trailingPE,
                        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
                        fiftyTwoWeekLow: quote.fiftyTwoWeekLow
                    };
                } catch (e) {
                    console.log('[Chat] Could not fetch stock data for:', symbol);
                }
            }
        }

        // System prompt for stock AI assistant
        const systemPrompt = `คุณคือ "Stockify AI" ผู้ช่วยวิเคราะห์หุ้นและการลงทุนขั้นสูง

บทบาทของคุณ:
- ตอบคำถามเกี่ยวกับหุ้น การลงทุน Technical Analysis
- อธิบายตัวชี้วัดทางเทคนิค (RSI, MACD, Moving Average, Bollinger Bands)
- วิเคราะห์แนวโน้มตลาดและหุ้นแต่ละตัว
- ให้คำแนะนำการลงทุนเบื้องต้น (พร้อมเตือนความเสี่ยง)
- ตอบเป็นภาษาไทย ใช้ภาษาเข้าใจง่าย

รูปแบบการตอบ:
- ใช้ emoji เพื่อให้อ่านง่าย (📈 📉 🎯 ⚠️ 💡)
- แบ่งหัวข้อชัดเจน
- ให้ข้อมูลเชิงลึก แต่กระชับ
- เตือนเสมอว่าไม่ใช่คำแนะนำทางการเงินอย่างเป็นทางการ

${stockData ? `
ข้อมูลหุ้นล่าสุด ${stockData.symbol}:
- ราคา: $${stockData.price?.toFixed(2)}
- เปลี่ยนแปลง: ${stockData.changePercent?.toFixed(2)}%
- High/Low วันนี้: $${stockData.high?.toFixed(2)} / $${stockData.low?.toFixed(2)}
- Volume: ${(stockData.volume / 1000000)?.toFixed(2)}M
- Market Cap: $${(stockData.marketCap / 1e9)?.toFixed(1)}B
- P/E Ratio: ${stockData.pe?.toFixed(2)}
- 52-Week High/Low: $${stockData.fiftyTwoWeekHigh?.toFixed(2)} / $${stockData.fiftyTwoWeekLow?.toFixed(2)}
` : ''}`;

        // Call OpenAI API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...(stockContext || []),
                    { role: 'user', content: message }
                ],
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('[Chat] OpenAI error:', error);
            throw new Error(error.error?.message || 'OpenAI API error');
        }

        const data = await response.json();
        const reply = data.choices[0]?.message?.content || 'ขออภัย ไม่สามารถตอบได้ในขณะนี้';

        console.log('[Chat] AI:', reply.substring(0, 100) + '...');

        res.json({
            reply,
            stockData,
            usage: data.usage
        });

    } catch (error) {
        console.error('[Chat] Error:', error.message);
        res.status(500).json({
            error: 'Chat failed',
            message: error.message
        });
    }
});

// Start broadcasting every 10 seconds
setInterval(broadcastPrices, 10000);

// ===================================
// Start Server
// ===================================
server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════╗
║   🚀 Stockify Backend Server                  ║
╠═══════════════════════════════════════════════╣
║   HTTP Server: http://localhost:${PORT}          ║
║   WebSocket:   ws://localhost:${PORT}/ws         ║
║   Frontend:    http://localhost:${PORT}/analyzer.html
╚═══════════════════════════════════════════════╝
    `);
});
