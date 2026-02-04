"use client";

import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues
const ChatBot = dynamic(() => import('./ChatBot'), {
    ssr: false,
    loading: () => null
});

export default function ChatBotWrapper() {
    return <ChatBot />;
}
