/**
 * Stock Data Service
 * Fetches real-time stock data from Backend Proxy
 */

(function () {
    'use strict';

    // ===================================
    // Configuration
    // ===================================
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const CONFIG = {
        // Backend API URL - empty in production (same origin via Nginx proxy)
        API_BASE: isLocalhost ? 'http://localhost:3001' : '',

        // WebSocket URL
        WS_URL: isLocalhost
            ? 'ws://localhost:3001/ws'
            : `ws://${window.location.host}/ws`,

        // Cache duration in milliseconds
        CACHE_DURATION: 30 * 1000, // 30 seconds

        // Fallback to simulation if backend is down
        USE_FALLBACK: true,
    };

    // ===================================
    // State
    // ===================================
    let websocket = null;
    let wsReconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const dataCache = new Map();
    const priceUpdateCallbacks = new Map();
    let backendAvailable = null; // null = unknown, true/false = tested

    // ===================================
    // Stock Database (for suggestions fallback)
    // ===================================
    const POPULAR_STOCKS = [
        { symbol: 'AAPL', name: 'Apple Inc.' },
        { symbol: 'MSFT', name: 'Microsoft Corporation' },
        { symbol: 'GOOGL', name: 'Alphabet Inc.' },
        { symbol: 'AMZN', name: 'Amazon.com Inc.' },
        { symbol: 'NVDA', name: 'NVIDIA Corporation' },
        { symbol: 'META', name: 'Meta Platforms Inc.' },
        { symbol: 'TSLA', name: 'Tesla Inc.' },
        { symbol: 'BRK-B', name: 'Berkshire Hathaway' },
        { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
        { symbol: 'V', name: 'Visa Inc.' },
        { symbol: 'JNJ', name: 'Johnson & Johnson' },
        { symbol: 'WMT', name: 'Walmart Inc.' },
        { symbol: 'PG', name: 'Procter & Gamble' },
        { symbol: 'MA', name: 'Mastercard Inc.' },
        { symbol: 'UNH', name: 'UnitedHealth Group' },
        { symbol: 'HD', name: 'The Home Depot' },
        { symbol: 'DIS', name: 'The Walt Disney Company' },
        { symbol: 'NFLX', name: 'Netflix Inc.' },
        { symbol: 'AMD', name: 'Advanced Micro Devices' },
        { symbol: 'CRM', name: 'Salesforce Inc.' },
        { symbol: 'INTC', name: 'Intel Corporation' },
        { symbol: 'CSCO', name: 'Cisco Systems' },
        { symbol: 'VZ', name: 'Verizon Communications' },
        { symbol: 'KO', name: 'The Coca-Cola Company' },
        { symbol: 'PEP', name: 'PepsiCo Inc.' },
        { symbol: 'XOM', name: 'Exxon Mobil Corporation' },
        { symbol: 'CVX', name: 'Chevron Corporation' },
        { symbol: 'BA', name: 'The Boeing Company' },
        { symbol: 'NKE', name: 'Nike Inc.' },
        { symbol: 'MCD', name: 'McDonald\'s Corporation' },
    ];

    // ===================================
    // Check Backend Availability
    // ===================================
    async function checkBackendHealth() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/health`, {
                method: 'GET',
                timeout: 3000
            });

            if (response.ok) {
                const data = await response.json();
                backendAvailable = true;
                console.log('✅ Backend server connected:', data);
                return true;
            }
        } catch (error) {
            console.warn('⚠️ Backend server not available:', error.message);
            backendAvailable = false;
        }
        return false;
    }

    // ===================================
    // Fetch Stock Data from Backend
    // ===================================
    async function fetchStockData(symbol) {
        symbol = symbol.toUpperCase();

        // Check cache first
        const cacheKey = `analysis_${symbol}`;
        const cached = dataCache.get(cacheKey);
        if (cached && Date.now() - cached.lastUpdated < CONFIG.CACHE_DURATION) {
            console.log(`[Cache] Using cached data for ${symbol}`);
            return cached;
        }

        // Check backend availability
        if (backendAvailable === null) {
            await checkBackendHealth();
        }

        // Try backend API
        if (backendAvailable) {
            try {
                console.log(`[API] Fetching ${symbol} from backend...`);
                const response = await fetch(`${CONFIG.API_BASE}/api/analysis/${symbol}`);

                if (response.ok) {
                    const data = await response.json();

                    // Format for compatibility
                    const result = {
                        symbol: data.symbol,
                        name: data.name,
                        quote: data.quote,
                        historical: data.historical,
                        lastUpdated: Date.now(),
                        source: 'backend'
                    };

                    dataCache.set(cacheKey, result);

                    // Connect WebSocket for real-time updates
                    subscribeToSymbol(symbol);

                    return result;
                }
            } catch (error) {
                console.error(`[API] Backend error for ${symbol}:`, error.message);
                backendAvailable = false;
            }
        }

        // Fallback to simulated data
        if (CONFIG.USE_FALLBACK) {
            console.log(`[Fallback] Using simulated data for ${symbol}`);
            const simulatedData = generateSimulatedData(symbol);
            dataCache.set(cacheKey, simulatedData);
            return simulatedData;
        }

        throw new Error('Backend not available and fallback disabled');
    }

    // ===================================
    // WebSocket Connection
    // ===================================
    function connectWebSocket() {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            console.log('[WS] Connecting to WebSocket...');
            websocket = new WebSocket(CONFIG.WS_URL);

            websocket.onopen = () => {
                console.log('✅ [WS] Connected');
                wsReconnectAttempts = 0;

                // Re-subscribe to all watched symbols
                priceUpdateCallbacks.forEach((_, symbol) => {
                    websocket.send(JSON.stringify({ action: 'subscribe', symbol }));
                });
            };

            websocket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);

                    if (message.type === 'quotes') {
                        message.data.forEach(quote => {
                            // Update cache
                            const cacheKey = `analysis_${quote.symbol}`;
                            const cached = dataCache.get(cacheKey);
                            if (cached) {
                                cached.quote.price = quote.price;
                                cached.quote.change = quote.change;
                                cached.quote.changePercent = quote.changePercent;
                                cached.quote.high = quote.high;
                                cached.quote.low = quote.low;
                                cached.quote.volume = quote.volume;
                                cached.lastUpdated = Date.now();
                            }

                            // Call registered callbacks
                            const callback = priceUpdateCallbacks.get(quote.symbol);
                            if (callback) {
                                callback(quote);
                            }
                        });
                    }
                } catch (e) {
                    console.error('[WS] Parse error:', e);
                }
            };

            websocket.onclose = () => {
                console.log('[WS] Disconnected');

                // Attempt reconnect
                if (wsReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    wsReconnectAttempts++;
                    console.log(`[WS] Reconnecting (${wsReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
                    setTimeout(connectWebSocket, 3000);
                }
            };

            websocket.onerror = (error) => {
                console.error('[WS] Error:', error);
            };

        } catch (error) {
            console.error('[WS] Connection failed:', error);
        }
    }

    function subscribeToSymbol(symbol) {
        if (!websocket || websocket.readyState !== WebSocket.OPEN) {
            connectWebSocket();
            // Will auto-subscribe after connection
            priceUpdateCallbacks.set(symbol, priceUpdateCallbacks.get(symbol) || (() => { }));
            return;
        }

        websocket.send(JSON.stringify({ action: 'subscribe', symbol }));
    }

    function onPriceUpdate(symbol, callback) {
        priceUpdateCallbacks.set(symbol.toUpperCase(), callback);
        subscribeToSymbol(symbol.toUpperCase());
    }

    // ===================================
    // Search Stocks
    // ===================================
    async function searchStocks(query) {
        if (!query || query.length < 1) return [];

        // Try backend search
        if (backendAvailable) {
            try {
                const response = await fetch(`${CONFIG.API_BASE}/api/search?q=${encodeURIComponent(query)}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.results && data.results.length > 0) {
                        return data.results;
                    }
                }
            } catch (error) {
                console.warn('[Search] Backend search failed:', error.message);
            }
        }

        // Fallback to local search
        const upperQuery = query.toUpperCase();
        return POPULAR_STOCKS.filter(stock =>
            stock.symbol.toUpperCase().includes(upperQuery) ||
            stock.name.toUpperCase().includes(upperQuery)
        ).slice(0, 8);
    }

    // ===================================
    // Simulated Data (Fallback)
    // ===================================
    function generateSimulatedData(symbol) {
        const basePrices = {
            'AAPL': 195.50, 'MSFT': 378.25, 'GOOGL': 141.80, 'AMZN': 178.90,
            'NVDA': 495.22, 'META': 356.40, 'TSLA': 248.50, 'JPM': 172.35,
            'V': 262.80, 'JNJ': 156.20, 'WMT': 158.45, 'MA': 428.60,
            'HD': 362.75, 'DIS': 92.30, 'NFLX': 487.50, 'AMD': 141.25,
            'CRM': 268.90, 'INTC': 45.80, 'KO': 59.25, 'NKE': 108.40,
        };

        const basePrice = basePrices[symbol] || 100 + Math.random() * 200;
        const volatility = 0.02;

        // Generate historical data
        const historicalData = [];
        let currentPrice = basePrice * (0.7 + Math.random() * 0.3);
        const now = new Date();

        for (let i = 365; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);

            if (date.getDay() === 0 || date.getDay() === 6) continue;

            const dailyReturn = (Math.random() - 0.48) * volatility * 2;
            currentPrice = currentPrice * (1 + dailyReturn);

            const dayVolatility = currentPrice * volatility * Math.random();
            const open = currentPrice * (1 + (Math.random() - 0.5) * 0.01);
            const high = Math.max(open, currentPrice) + dayVolatility * 0.5;
            const low = Math.min(open, currentPrice) - dayVolatility * 0.5;
            const volume = Math.floor(10000000 + Math.random() * 50000000);

            historicalData.push({
                date: date.toISOString().split('T')[0],
                timestamp: date.getTime() / 1000,
                open: parseFloat(open.toFixed(2)),
                high: parseFloat(high.toFixed(2)),
                low: parseFloat(low.toFixed(2)),
                close: parseFloat(currentPrice.toFixed(2)),
                volume: volume
            });
        }

        const latestBar = historicalData[historicalData.length - 1];
        const prevClose = historicalData[historicalData.length - 2]?.close || latestBar.open;
        const change = latestBar.close - prevClose;
        const changePercent = (change / prevClose) * 100;

        return {
            symbol: symbol,
            name: POPULAR_STOCKS.find(s => s.symbol === symbol)?.name || `${symbol} Inc.`,
            quote: {
                price: latestBar.close,
                change: parseFloat(change.toFixed(2)),
                changePercent: parseFloat(changePercent.toFixed(2)),
                high: latestBar.high,
                low: latestBar.low,
                open: latestBar.open,
                prevClose: prevClose,
                volume: latestBar.volume,
                marketCap: Math.floor(latestBar.close * (1000000000 + Math.random() * 2000000000)),
            },
            historical: historicalData,
            lastUpdated: Date.now(),
            source: 'simulated'
        };
    }

    // ===================================
    // Real-time Simulation (Fallback)
    // ===================================
    function simulateRealTimeUpdate(stockData) {
        const volatility = 0.001;
        const currentPrice = stockData.quote.price;
        const change = currentPrice * (Math.random() - 0.5) * volatility * 2;

        stockData.quote.price = parseFloat((currentPrice + change).toFixed(2));
        stockData.quote.change = parseFloat((stockData.quote.price - stockData.quote.prevClose).toFixed(2));
        stockData.quote.changePercent = parseFloat(((stockData.quote.change / stockData.quote.prevClose) * 100).toFixed(2));

        if (stockData.quote.price > stockData.quote.high) {
            stockData.quote.high = stockData.quote.price;
        }
        if (stockData.quote.price < stockData.quote.low) {
            stockData.quote.low = stockData.quote.price;
        }

        stockData.lastUpdated = Date.now();
        return stockData;
    }

    // ===================================
    // Format Helpers
    // ===================================
    function formatPrice(price) {
        if (price >= 1000) {
            return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return price.toFixed(2);
    }

    function formatVolume(volume) {
        if (volume >= 1e9) return (volume / 1e9).toFixed(2) + 'B';
        if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M';
        if (volume >= 1e3) return (volume / 1e3).toFixed(2) + 'K';
        return volume.toString();
    }

    function formatMarketCap(marketCap) {
        if (!marketCap) return 'N/A';
        if (marketCap >= 1e12) return '$' + (marketCap / 1e12).toFixed(2) + 'T';
        if (marketCap >= 1e9) return '$' + (marketCap / 1e9).toFixed(2) + 'B';
        if (marketCap >= 1e6) return '$' + (marketCap / 1e6).toFixed(2) + 'M';
        return '$' + marketCap.toLocaleString();
    }

    // ===================================
    // Initialize
    // ===================================
    async function init() {
        await checkBackendHealth();
        if (backendAvailable) {
            connectWebSocket();
        }
    }

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ===================================
    // Export Public API
    // ===================================
    window.StockDataService = {
        fetchStockData,
        searchStocks,
        simulateRealTimeUpdate,
        onPriceUpdate,
        formatPrice,
        formatVolume,
        formatMarketCap,
        checkBackendHealth,
        isBackendAvailable: () => backendAvailable,
        POPULAR_STOCKS,
        CONFIG
    };

    console.log('📊 Stock Data Service loaded (Backend Proxy Mode)');

})();
