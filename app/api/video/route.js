import fs from 'fs';
import path from 'path';
import axios from 'axios';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CONFIG = {
    API_URL: 'https://www.runninghub.ai/task/create',
    HISTORY_URL: 'https://www.runninghub.ai/api/output/v2/history',
    WORKFLOW_FILE: path.join(process.cwd(), 'storage', 'videoWorkflow.json'),
    POLL_INTERVAL: 10000, // 10 seconds for video generation
    MAX_POLL_ATTEMPTS: 60 // 10 minutes max
};

const GALLERY_FILE = path.join(process.cwd(), 'storage', 'gallery.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createHeaders = (apiKey) => ({
    'Content-Type': 'application/json',
    origin: 'https://www.runninghub.ai',
    referer: 'https://www.runninghub.ai/',
    Authorization: `Bearer ${apiKey}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    'user-language': 'en-US'
});

const loadToken = () => {
    const tokenPath = path.join(process.cwd(), 'storage', 'token.json');
    if (!fs.existsSync(tokenPath)) throw new Error('token.json not found');
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    if (!token.access_token) throw new Error('access_token missing in token.json');
    return token.access_token;
};

const loadWorkflow = (opts) => {
    if (!fs.existsSync(CONFIG.WORKFLOW_FILE)) throw new Error('videoWorkflow.json not found');
    const workflow = JSON.parse(fs.readFileSync(CONFIG.WORKFLOW_FILE, 'utf-8'));
    const promptContent = JSON.parse(workflow.promptContent || '{}');

    // Update positive prompt (node 88 - PrimitiveStringMultiline)
    if (promptContent?.prompt?.['88']) {
        promptContent.prompt['88'].inputs.value = opts.prompt;
    }

    // Update negative prompt (node 7)
    if (promptContent?.prompt?.['7']) {
        promptContent.prompt['7'].inputs.text = opts.negative;
    }

    // Update video dimensions (node 112 - mxSlider2D)
    if (promptContent?.prompt?.['112']) {
        promptContent.prompt['112'].inputs.Xi = opts.width;
        promptContent.prompt['112'].inputs.Xf = opts.width;
        promptContent.prompt['112'].inputs.Yi = opts.height;
        promptContent.prompt['112'].inputs.Yf = opts.height;
    }

    // Update video length (node 50 - WanImageToVideo)
    if (promptContent?.prompt?.['50']) {
        promptContent.prompt['50'].inputs.width = opts.width;
        promptContent.prompt['50'].inputs.height = opts.height;
        promptContent.prompt['50'].inputs.length = opts.length;
    }

    // Update seed (node 82)
    if (promptContent?.prompt?.['82']) {
        promptContent.prompt['82'].inputs.seed = opts.seed;
    }

    workflow.promptContent = JSON.stringify(promptContent);
    return workflow;
};

const submitTask = async (apiKey, payload) => {
    const resp = await axios.post(CONFIG.API_URL, payload, { headers: createHeaders(apiKey) });
    console.log('RunningHub response:', JSON.stringify(resp.data, null, 2));

    if (resp.status !== 200) throw new Error(`HTTP ${resp.status}`);

    // Check for error in response
    if (resp.data.code !== 0) {
        throw new Error(resp.data.msg || resp.data.errorMessages || 'API error');
    }

    const taskId = resp.data.data?.taskId;
    if (!taskId) throw new Error('taskId missing in response: ' + JSON.stringify(resp.data));
    return taskId;
};

const pollTaskStatus = async (apiKey, taskId) => {
    let attempt = 0;
    while (attempt < CONFIG.MAX_POLL_ATTEMPTS) {
        attempt++;
        await sleep(CONFIG.POLL_INTERVAL);

        try {
            const resp = await axios.post(
                CONFIG.HISTORY_URL,
                { size: 20, current: 1, taskType: ['WORKFLOW', 'WEBAPP'], fromId: '' },
                { headers: createHeaders(apiKey) }
            );

            if (resp.status !== 200) throw new Error(`HTTP ${resp.status}`);

            const tasks = resp.data.data || [];
            const taskData = tasks.find(t => t.taskId === taskId);

            if (!taskData) {
                continue;
            }

            const { taskStatus, fileUrl } = taskData;

            if (taskStatus === 'SUCCESS') {
                return fileUrl;
            }

            if (taskStatus === 'FAILED') {
                throw new Error('Video generation failed');
            }

            // Still running, continue polling
        } catch (err) {
            if (err.message === 'Video generation failed') throw err;
            console.log('Poll error:', err.message);
        }
    }

    throw new Error('Video generation timeout');
};

const fetchVideoUrl = async (fileUrl) => {
    const resp = await axios.get(fileUrl, { timeout: 30000 });
    let content = resp.data;

    // If it's a text file with URL
    if (typeof content === 'string') {
        content = content.trim();
        // Return the first line which should be the video URL
        const lines = content.split('\n').filter(l => l.trim());
        return lines[0] || content;
    }

    return content;
};

// Gallery functions
const ensureStorage = () => {
    const dataDir = path.dirname(GALLERY_FILE);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
};

const readGallery = () => {
    try {
        return JSON.parse(fs.readFileSync(GALLERY_FILE, 'utf-8'));
    } catch {
        return [];
    }
};

const writeGallery = (items) => {
    fs.writeFileSync(GALLERY_FILE, JSON.stringify(items, null, 2), 'utf-8');
};

const saveToGallery = (url, meta) => {
    ensureStorage();
    const gallery = readGallery();

    const entry = {
        file: url,
        type: 'video',
        createdAt: new Date().toISOString(),
        ...meta
    };
    gallery.unshift(entry);

    // Keep latest 200 entries
    writeGallery(gallery.slice(0, 200));
    return url;
};

export async function POST(request) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (data) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            try {
                const body = await request.json();

                // Max 8 seconds = 129 frames
                const maxLength = 129;
                let length = Number(body.length || 81);
                if (length > maxLength) length = maxLength;
                if (length < 17) length = 17;

                const opts = {
                    prompt: body.prompt?.toString() || 'A beautiful landscape animation',
                    negative: body.negative?.toString() || 'censored, blurry, low quality, worst quality',
                    width: Number(body.width || 480),
                    height: Number(body.height || 720),
                    length,
                    seed: body.seed === 'random' || body.seed === undefined
                        ? Math.floor(Math.random() * 1e15)
                        : Number(body.seed),
                };

                const apiKey = loadToken();
                const workflow = loadWorkflow(opts);

                // Submit task and send taskId immediately
                const taskId = await submitTask(apiKey, workflow);
                send({ type: 'taskId', taskId });

                // Poll for results
                const fileUrl = await pollTaskStatus(apiKey, taskId);
                const videoUrl = await fetchVideoUrl(fileUrl);

                // Save to gallery
                saveToGallery(videoUrl, {
                    prompt: opts.prompt,
                    negative: opts.negative,
                    seed: opts.seed,
                    width: opts.width,
                    height: opts.height,
                    length: opts.length
                });

                send({ type: 'result', videoUrl, seed: opts.seed });
            } catch (err) {
                console.error('Video API error:', err.message);
                send({ type: 'error', message: err.message });
            } finally {
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        }
    });
}
