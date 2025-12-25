/**
 * Stockify AI Chatbot
 * Advanced GPT-powered Stock Analysis Assistant
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
    let conversationHistory = [];
    let isWaiting = false;

    // ===================================
    // DOM Elements
    // ===================================
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const quickActions = document.getElementById('quick-actions');

    // ===================================
    // Initialize
    // ===================================
    function init() {
        // Event listeners
        sendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Quick action buttons
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const message = btn.dataset.message;
                chatInput.value = message;
                sendMessage();
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

        // Focus input
        chatInput.focus();

        console.log('🤖 Stockify AI Chatbot initialized');
    }

    // ===================================
    // Send Message
    // ===================================
    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message || isWaiting) return;

        // Add user message to UI
        appendMessage('user', message);
        chatInput.value = '';

        // Hide quick actions after first message
        if (quickActions) {
            quickActions.style.display = 'none';
        }

        // Show typing indicator
        const typingEl = showTypingIndicator();

        isWaiting = true;
        sendBtn.disabled = true;

        try {
            // Prepare conversation context (last 10 messages)
            const contextMessages = conversationHistory.slice(-10);

            // Call API
            const response = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    stockContext: contextMessages
                })
            });

            // Remove typing indicator
            if (typingEl) typingEl.remove();

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to get response');
            }

            const data = await response.json();

            // Add bot message to UI
            appendMessage('bot', data.reply, data.stockData);

            // Update conversation history
            conversationHistory.push(
                { role: 'user', content: message },
                { role: 'assistant', content: data.reply }
            );

        } catch (error) {
            console.error('Chat error:', error);
            if (typingEl) typingEl.remove();

            appendMessage('bot', `❌ เกิดข้อผิดพลาด: ${error.message}\n\nลองใหม่อีกครั้งครับ`);
        } finally {
            isWaiting = false;
            sendBtn.disabled = false;
            chatInput.focus();
        }
    }

    // ===================================
    // Append Message to Chat
    // ===================================
    function appendMessage(type, text, stockData = null) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;

        const avatar = type === 'bot' ? '🤖' : '👤';
        const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

        // Format text with markdown-like formatting
        const formattedText = formatText(text);

        let stockCardHtml = '';
        if (stockData) {
            const changeClass = stockData.changePercent >= 0 ? 'positive' : 'negative';
            const changeSign = stockData.changePercent >= 0 ? '+' : '';
            stockCardHtml = `
                <div class="stock-card-mini">
                    <div class="stat">
                        <span class="stat-label">ราคา</span>
                        <span class="stat-value">$${stockData.price?.toFixed(2)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">เปลี่ยนแปลง</span>
                        <span class="stat-value ${changeClass}">${changeSign}${stockData.changePercent?.toFixed(2)}%</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">High/Low</span>
                        <span class="stat-value">$${stockData.high?.toFixed(2)} / $${stockData.low?.toFixed(2)}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Volume</span>
                        <span class="stat-value">${formatVolume(stockData.volume)}</span>
                    </div>
                </div>
            `;
        }

        messageEl.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-text">
                    ${formattedText}
                    ${stockCardHtml}
                </div>
                <div class="message-time">${time}</div>
            </div>
        `;

        chatMessages.appendChild(messageEl);
        scrollToBottom();
    }

    // ===================================
    // Format Text (Simple Markdown)
    // ===================================
    function formatText(text) {
        if (!text) return '';

        // Split into paragraphs
        let formatted = text
            // Bold text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Bullet points
            .replace(/^[-•]\s*(.+)$/gm, '<li>$1</li>')
            // Line breaks to paragraphs
            .split('\n\n')
            .map(para => {
                if (para.includes('<li>')) {
                    return `<ul>${para}</ul>`;
                }
                return `<p>${para.replace(/\n/g, '<br>')}</p>`;
            })
            .join('');

        return formatted;
    }

    // ===================================
    // Format Volume
    // ===================================
    function formatVolume(volume) {
        if (!volume) return 'N/A';
        if (volume >= 1e9) return (volume / 1e9).toFixed(2) + 'B';
        if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M';
        if (volume >= 1e3) return (volume / 1e3).toFixed(2) + 'K';
        return volume.toString();
    }

    // ===================================
    // Typing Indicator
    // ===================================
    function showTypingIndicator() {
        const typingEl = document.createElement('div');
        typingEl.className = 'message bot';
        typingEl.id = 'typing-indicator';
        typingEl.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <span style="color: var(--text-muted); font-size: 0.85rem;">กำลังคิด...</span>
                </div>
            </div>
        `;
        chatMessages.appendChild(typingEl);
        scrollToBottom();
        return typingEl;
    }

    // ===================================
    // Scroll to Bottom
    // ===================================
    function scrollToBottom() {
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
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
