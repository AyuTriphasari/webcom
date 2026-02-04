import axios from "axios";
import { NextResponse } from "next/server";

const CHAT_URL = "https://yunwu.ai/v1/chat/completions";
const token = process.env.YUNWU_API_KEY;
const model = "grok-4-fast";

export const ENHANCE_SYSTEM_PROMPT_IMG = `You are a prompt engineer that helps to enhance image generation prompts for illustrious model.
Given a user's prompt, you will enhance it by adding more details, styles, and descriptions to make it more vivid and specific for image generation.
if embeddings words provided make sure you use it again. e.g: embedding:Lazy_Embeddings/Positive/lazypos

Respond only with the enhanced prompt without any additional text.`;

const ENHANCE_SYSTEM_PROMPT_VID = `You are ai prompt engineer that helps to enhance video generation prompts for wan 2.2 model.
Given a user's prompt, you will enhance it by adding more details, styles, and descriptions to make it more vivid and specific for video generation.
if embeddings words provided make sure you use it again. e.g: embedding:Lazy_Embeddings/Positive/lazypos

Respond only with the enhanced prompt without any additional text.`;

// Regular chat completions (for thinking & final answer)
export async function enchance_prompt({
    prompt,
    type = "image"
}) {
    const payload = {
        model,
        max_tokens: 1000,
        messages: [
            {
                role: "system",
                content: type === "image" ? ENHANCE_SYSTEM_PROMPT_IMG : ENHANCE_SYSTEM_PROMPT_VID
            },
            {
                role: "user",
                content: `Do not creating images or videos. Enhance the following prompt for ${type} generation: "${prompt}"`
            }
        ]
    };

    const res = await axios.post(CHAT_URL, payload, {
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        timeout: 120_000
    });

    return res.data;
}

// POST handler for API route
export async function POST(request) {
    try {
        const body = await request.json();
        const { prompt, type = "image" } = body;

        if (!prompt) {
            return NextResponse.json({ message: "Prompt is required" }, { status: 400 });
        }

        const result = await enchance_prompt({ prompt, type });
        const enhancedPrompt = result.choices?.[0]?.message?.content || prompt;

        return NextResponse.json({
            original: prompt,
            enhanced: enhancedPrompt
        });
    } catch (err) {
        console.error("Enhance API error:", err.message);
        return NextResponse.json({ message: err.message }, { status: 500 });
    }
}


