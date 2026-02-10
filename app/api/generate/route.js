import fs from 'fs';
import path from 'path';
import axios from 'axios';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300; // 5 minutes max for image generation

const CONFIG = {
    API_URL: 'https://www.runninghub.ai/task/create',
    HISTORY_URL: 'https://www.runninghub.ai/api/output/v2/history',
    WORKFLOW_FILE: path.join(process.cwd(), 'storage', 'imageWorkflow.json'),
    POLL_INTERVAL: 5000
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
    if (!fs.existsSync(CONFIG.WORKFLOW_FILE)) throw new Error('imageWorkflow.json not found');
    const workflow = JSON.parse(fs.readFileSync(CONFIG.WORKFLOW_FILE, 'utf-8'));
    const promptContent = JSON.parse(workflow.promptContent || '{}');

    if (promptContent?.prompt?.['6']) promptContent.prompt['6'].inputs.text = opts.prompt;
    if (promptContent?.prompt?.['7']) promptContent.prompt['7'].inputs.text = opts.negative;
    if (promptContent?.prompt?.['254']) promptContent.prompt['254'].inputs.ckpt_name = opts.model;
    if (promptContent?.prompt?.['257']) {
        promptContent.prompt['257'].inputs.width = opts.width;
        promptContent.prompt['257'].inputs.height = opts.height;
        promptContent.prompt['257'].inputs.batch_size = opts.batch;
    }
    if (promptContent?.prompt?.['258']) {
        promptContent.prompt['258'].inputs.seed = opts.seed;
        promptContent.prompt['258'].inputs.steps = opts.steps;
        promptContent.prompt['258'].inputs.cfg = opts.cfg;
    }

    workflow.promptContent = JSON.stringify(promptContent);
    return workflow;
};

const submitTask = async (apiKey, payload) => {
    const resp = await axios.post(CONFIG.API_URL, payload, { headers: createHeaders(apiKey) });
    if (resp.status !== 200) throw new Error(`HTTP ${resp.status}`);
    const taskId = resp.data.data?.taskId;
    if (!taskId) throw new Error('taskId missing');
    return taskId;
};

const pollTaskStatus = async (apiKey, taskId, onProgress) => {
    let attempt = 0;
    const maxAttempts = 60; // ~5 minutes max
    while (attempt < maxAttempts) {
        attempt++;
        await sleep(CONFIG.POLL_INTERVAL);

        // Send heartbeat to keep SSE connection alive
        if (onProgress) {
            onProgress({ type: 'heartbeat', attempt, maxAttempts });
        }

        try {
            const resp = await axios.post(
                CONFIG.HISTORY_URL,
                { size: 20, current: 1, taskType: ['WORKFLOW', 'WEBAPP'], fromId: '' },
                { headers: createHeaders(apiKey) }
            );
            if (resp.status !== 200) throw new Error(`HTTP ${resp.status}`);
            const taskData = resp.data.data?.[0];
            if (!taskData) {
                continue;
            }
            const { taskStatus, taskId: currentTaskId, fileUrl } = taskData;
            if (currentTaskId !== taskId) {
                continue;
            }
            if (taskStatus === 'SUCCESS') return fileUrl;
            if (taskStatus === 'FAILED') throw new Error('Task failed');
        } catch (err) {
            if (err.message === 'Task failed') throw err;
            console.log('Poll error:', err.message);
        }
    }
    throw new Error('Generation timeout');
};

const fetchImageUrls = async (fileUrl) => {
    const resp = await axios.get(fileUrl, { timeout: 30000 });
    let urls = resp.data;
    if (typeof urls === 'string') urls = urls.trim().split('\n').filter((u) => u.trim());
    if (!Array.isArray(urls)) urls = [urls];
    return urls;
};

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

const saveToGallery = (urls, meta) => {
    ensureStorage();
    const gallery = readGallery();

    urls.forEach((url, i) => {
        if (!url) return;

        const entry = {
            file: url,
            createdAt: new Date().toISOString(),
            ...meta
        };
        gallery.unshift(entry);
    });

    // Keep latest 200 entries
    writeGallery(gallery.slice(0, 200));
    return urls;
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
                const opts = {
                    prompt: body.prompt?.toString() || 'A cinematic landscape at sunset, ultra-detailed',
                    negative: body.negative?.toString() || 'low quality, blurry, artifacts, watermark, text, logo, nsfw',
                    steps: Number(body.steps || 25),
                    cfg: Number(body.cfg || 4),
                    width: Number(body.width || 1024),
                    height: Number(body.height || 1024),
                    batch: Number(body.batch || 2),
                    seed: body.seed === 'random' || body.seed === undefined ? Math.floor(Math.random() * 1e12) : Number(body.seed),
                    model: body.model?.toString() || 'new_waiIllustriousSDXL_v160.safetensors'
                };

                const apiKey = loadToken();
                const workflow = loadWorkflow(opts);

                // Submit task and send taskId immediately
                const taskId = await submitTask(apiKey, workflow);
                send({ type: 'taskId', taskId });

                // Poll for results (send heartbeat to keep connection alive)
                const fileUrl = await pollTaskStatus(apiKey, taskId, send);
                const imageUrls = await fetchImageUrls(fileUrl);

                // Save metadata to gallery
                saveToGallery(imageUrls, {
                    prompt: opts.prompt,
                    negative: opts.negative,
                    model: opts.model,
                    seed: opts.seed,
                    steps: opts.steps,
                    cfg: opts.cfg,
                    width: opts.width,
                    height: opts.height,
                    batch: opts.batch
                });

                send({ type: 'result', files: imageUrls });
            } catch (err) {
                console.error('API error:', err.message);
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
