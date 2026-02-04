"use client";

import { useState, useRef, useEffect } from 'react';

// Simple markdown parser for chat messages
function parseMarkdown(text) {
    if (!text) return '';

    let html = text
        // Escape HTML
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Images ![alt](url) - must be before links
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<div class="chat-image-container"><img src="$2" alt="$1" class="chat-image" loading="lazy" onclick="window.open(\'$2\', \'_blank\')" /><span class="chat-image-caption">$1</span></div>')
        // Code blocks (```)
        .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        // Inline code (`)
        .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
        // Bold (**text** or __text__)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        // Italic (*text* or _text_)
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/_([^_]+)_/g, '<em>$1</em>')
        // Headers (## text)
        .replace(/^### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^## (.+)$/gm, '<h3>$1</h3>')
        .replace(/^# (.+)$/gm, '<h2>$1</h2>')
        // Unordered lists (- or *)
        .replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>')
        // Ordered lists (1. 2. etc)
        .replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>')
        // Links [text](url)
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        // Line breaks
        .replace(/\n/g, '<br>');

    // Wrap consecutive <li> elements in <ul>
    html = html.replace(/(<li>.*?<\/li>)(<br>)?/g, '$1');
    html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, '<ul>$&</ul>');

    return html;
}

const STORAGE_KEY = 'zlk_chat_history';
const MAX_HISTORY = 10; // Max messages to keep (pairs of user+assistant)
const DEFAULT_MESSAGE = {
    role: 'assistant',
    content: 'Hello! 👋 I\'m ZLK Assistant. How can I help you with image or video generation today?'
};

// Load messages from localStorage
function loadMessages() {
    if (typeof window === 'undefined') return [DEFAULT_MESSAGE];
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (e) {
        console.error('Failed to load chat history:', e);
    }
    return [DEFAULT_MESSAGE];
}

// Save messages to localStorage (keep last MAX_HISTORY messages)
function saveMessages(messages) {
    if (typeof window === 'undefined') return;
    try {
        // Keep only last MAX_HISTORY messages (but always keep the first greeting)
        const toSave = messages.length > MAX_HISTORY
            ? [messages[0], ...messages.slice(-(MAX_HISTORY - 1))]
            : messages;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
        console.error('Failed to save chat history:', e);
    }
}

export default function ChatBot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([DEFAULT_MESSAGE]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Load history on mount
    useEffect(() => {
        const saved = loadMessages();
        setMessages(saved);
        setIsInitialized(true);
    }, []);

    // Save history when messages change
    useEffect(() => {
        if (isInitialized && messages.length > 0) {
            saveMessages(messages);
        }
    }, [messages, isInitialized]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');

        // Add user message
        const newMessages = [...messages, { role: 'user', content: userMessage }];
        setMessages(newMessages);
        setLoading(true);

        try {
            // Send only last MAX_HISTORY messages to API to save tokens
            const messagesToSend = newMessages.length > MAX_HISTORY
                ? newMessages.slice(-MAX_HISTORY)
                : newMessages;

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messagesToSend.map(m => ({ role: m.role, content: m.content }))
                })
            });

            const data = await response.json();

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.message || 'Sorry, an error occurred. Please try again.'
            }]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, connection error. Please try again.'
            }]);
        } finally {
            setLoading(false);
        }
    };

    const clearChat = () => {
        const cleared = [DEFAULT_MESSAGE];
        setMessages(cleared);
        saveMessages(cleared);
    };

    return (
        <>
            {/* Chat Toggle Button */}
            <button
                className={`chatbot-toggle ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Toggle chat"
            >
                {isOpen ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                )}
            </button>

            {/* Chat Window */}
            <div className={`chatbot-window ${isOpen ? 'open' : ''}`}>
                {/* Header */}
                <div className="chatbot-header">
                    <div className="chatbot-header-info">
                        <div className="chatbot-avatar">
                            <span>⚡</span>
                        </div>
                        <div>
                            <h3>ZLK Assistant</h3>
                            <span className="chatbot-status">
                                <span className="status-dot"></span>
                                Online
                            </span>
                        </div>
                    </div>
                    <div className="chatbot-header-actions">
                        <button onClick={clearChat} className="chatbot-clear" title="Clear chat">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                        </button>
                        <button onClick={() => setIsOpen(false)} className="chatbot-close">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="chatbot-messages">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`chatbot-message ${msg.role}`}>
                            {msg.role === 'assistant' && (
                                <div className="message-avatar">⚡</div>
                            )}
                            <div className="message-content">
                                <div
                                    className="message-bubble markdown-content"
                                    dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
                                />
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="chatbot-message assistant">
                            <div className="message-avatar">⚡</div>
                            <div className="message-content">
                                <div className="message-bubble typing">
                                    <span className="typing-dot"></span>
                                    <span className="typing-dot"></span>
                                    <span className="typing-dot"></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={sendMessage} className="chatbot-input-form">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type a message..."
                        disabled={loading}
                        className="chatbot-input"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || loading}
                        className="chatbot-send"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                        </svg>
                    </button>
                </form>

                {/* Quick Actions */}
                <div className="chatbot-quick-actions">
                    <button onClick={() => setInput('How do I generate an image?')}>
                        🖼️ Generate Image
                    </button>
                    <button onClick={() => setInput('How do I create a video?')}>
                        🎬 Generate Video
                    </button>
                    <button onClick={() => setInput('Tips for writing good prompts')}>
                        ✨ Prompt Tips
                    </button>
                </div>
            </div>
        </>
    );
}
