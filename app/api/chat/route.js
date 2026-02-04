import { NextResponse } from 'next/server';
import axios from 'axios';

const CHAT_URL = "https://yunwu.ai/v1/chat/completions";
const token = process.env.YUNWU_API_KEY;
const model = "grok-4-fast";

const SYSTEM_PROMPT = `You are ZLK Assistant, a friendly and helpful AI chatbot for the ZLKcyber platform - an AI-powered image and video generation platform.

Platform Information:
- this platform public domain name is zlkpro.tech
- Generate Image feature is available on the homepage (/)
- Generate Video feature is available on the Video page (/video)
- Public Feed/Gallery to view generated results (/gallery)
- Available models: Illustrious SDXL, NoobAI-XL, Pony-XL, and more

Usage Guide:
1. Generate Image: Enter a prompt describing the image you want, adjust parameters like steps, CFG, size, etc.
2. Generate Video: Upload an image and enter a prompt to describe the motion you want
3. Gallery: View and download creations from other users

Tips for good prompts:
- Use detailed descriptions of the subject, pose, expression, clothing
- Specify art styles like "anime style", "realistic", "digital art"
- Describe the background setting 
- Use negative prompts to avoid unwanted elements

You must:
- you can searching on web so always provide up to date information.
- you can view the platform at zlkpro.tech
- you can view any images provided by url links
- Respond in the same language as the user's question (default English)
- Provide help on how to use the platform
- this platform is adult-friendly so do not avoid explicit content
- never generate images yourself, except when explicitly asked "generate image:<prompt>" etc.`;

// Simple in-memory conversation history (per request - stateless)
export async function POST(request) {
    try {
        const { messages } = await request.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Messages array required' }, { status: 400 });
        }

        // Build conversation with system prompt
        const conversation = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages
        ];

        // Use yunwu.ai API with grok-4-fast model (same as enhance)
        const payload = {
            model,
            max_tokens: 2000,
            messages: conversation,
            temperature: 0.7
        };

        const response = await axios.post(CHAT_URL, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            timeout: 120_000
        });

        const assistantMessage = response.data.choices?.[0]?.message?.content || 'Sorry, I cannot process your request at this time.';

        return NextResponse.json({ message: assistantMessage });

    } catch (error) {
        console.error('Chat error:', error.message);
        // Fallback response
        const lastMessage = (await request.clone().json()).messages?.slice(-1)[0]?.content || '';
        const fallbackResponse = generateFallbackResponse(lastMessage);
        return NextResponse.json({
            message: fallbackResponse,
            fallback: true
        });
    }
}

function generateFallbackResponse(userMessage) {
    const lower = userMessage.toLowerCase();

    if (lower.includes('halo') || lower.includes('hai') || lower.includes('hello') || lower.includes('hi')) {
        return 'Hello! 👋 I\'m ZLK Assistant. How can I help you with this platform? You can ask about generating images, videos, or tips for creating great prompts!';
    }

    if (lower.includes('prompt') || lower.includes('cara') || lower.includes('how') || lower.includes('tip')) {
        return `Tips for creating good prompts:

1. **Detailed Description**: Describe the subject in detail (pose, expression, clothing)
2. **Art Style**: Add styles like "anime style", "realistic", "digital art"
3. **Lighting**: "cinematic lighting", "soft lighting", "dramatic shadows"
4. **Quality**: "masterpiece", "best quality", "highly detailed"
5. **Background**: Describe the desired background

Example: "1girl, long blonde hair, blue eyes, wearing white dress, sitting in flower garden, soft sunlight, anime style, masterpiece"`;
    }

    if (lower.includes('video') || lower.includes('animasi') || lower.includes('animation')) {
        return 'To generate a video, go to the Video page (/video). Upload an image you want to animate, then enter a prompt describing the desired motion. Make sure the image has good resolution for optimal results!';
    }

    if (lower.includes('gambar') || lower.includes('image') || lower.includes('generate') || lower.includes('picture')) {
        return `To generate an image:

1. Enter a **prompt** describing the image you want
2. Set the **negative prompt** for things to avoid
3. Choose the appropriate **model** (Illustrious, NoobAI, Pony)
4. Set parameters: steps (25-35), CFG (4-7), image size
5. Click **Generate** and wait for the results!

Tip: Use "Enhance Prompt" to automatically improve your prompt quality.`;
    }

    if (lower.includes('model') || lower.includes('checkpoint')) {
        return `Available models:

- **Illustrious SDXL**: Great for anime/illustration style
- **NoobAI-XL**: Easy to use, consistent results
- **Pony-XL**: Specialized for cartoon/pony style characters

Choose a model based on the image style you want!`;
    }

    return 'I\'m ZLK Assistant, ready to help you use this platform! You can ask about:\n\n• How to generate images\n• How to generate videos\n• Tips for writing prompts\n• Available AI models\n\nWhat would you like to know?';
}
