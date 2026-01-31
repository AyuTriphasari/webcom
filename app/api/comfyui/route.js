import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CONFIG = {
    API_URL: process.env.COMFYUI_API_URL,
    WORKFLOW_FILE: path.join(process.cwd(), 'storage', 'comfyui.json'),
    POLL_INTERVAL: 2000,
    MAX_POLL_ATTEMPTS: 120 // 4 minutes max
};

const GALLERY_FILE = path.join(process.cwd(), 'storage', 'gallery.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Generate unique client ID
const generateClientId = () => {
    return 'xxxx-xxxx-xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
};

const loadWorkflow = (opts) => {
    if (!fs.existsSync(CONFIG.WORKFLOW_FILE)) throw new Error('comfyui.json not found');
    const workflow = JSON.parse(fs.readFileSync(CONFIG.WORKFLOW_FILE, 'utf-8'));

    // Update prompt (node 6)
    if (workflow['6']?.inputs) {
        workflow['6'].inputs.text = opts.prompt;
    }

    // Update negative prompt (node 7)
    if (workflow['7']?.inputs) {
        workflow['7'].inputs.text = opts.negative;
    }

    // Update model/checkpoint (node 4)
    if (workflow['4']?.inputs && opts.model) {
        workflow['4'].inputs.ckpt_name = opts.model;
    }

    // Update latent image size (node 5)
    if (workflow['5']?.inputs) {
        workflow['5'].inputs.width = opts.width;
        workflow['5'].inputs.height = opts.height;
        workflow['5'].inputs.batch_size = opts.batch;
    }

    // Update sampler settings (node 3)
    if (workflow['3']?.inputs) {
        workflow['3'].inputs.seed = opts.seed;
        workflow['3'].inputs.steps = opts.steps;
        workflow['3'].inputs.cfg = opts.cfg;
    }

    return workflow;
};

// Queue prompt to ComfyUI
const queuePrompt = async (workflow, clientId) => {
    const payload = {
        prompt: workflow,
        client_id: clientId
    };

    const resp = await axios.post(`${CONFIG.API_URL}/prompt`, payload, {
        headers: { 'Content-Type': 'application/json' }
    });

    if (resp.status !== 200) throw new Error(`HTTP ${resp.status}`);
    return resp.data.prompt_id;
};

// Get history for a prompt
const getHistory = async (promptId) => {
    const resp = await axios.get(`${CONFIG.API_URL}/history/${promptId}`);
    if (resp.status !== 200) throw new Error(`HTTP ${resp.status}`);
    return resp.data;
};

// Poll for completion
const pollForCompletion = async (promptId) => {
    let attempts = 0;

    while (attempts < CONFIG.MAX_POLL_ATTEMPTS) {
        attempts++;
        await sleep(CONFIG.POLL_INTERVAL);

        try {
            const history = await getHistory(promptId);

            if (history[promptId]) {
                const outputs = history[promptId].outputs;
                const images = [];

                // Find all image outputs
                for (const nodeId in outputs) {
                    const nodeOutput = outputs[nodeId];
                    if (nodeOutput.images) {
                        for (const img of nodeOutput.images) {
                            images.push({
                                filename: img.filename,
                                subfolder: img.subfolder || '',
                                type: img.type || 'output'
                            });
                        }
                    }
                }

                if (images.length > 0) {
                    return images;
                }
            }
        } catch (err) {
            console.log(`Poll attempt ${attempts}: ${err.message}`);
        }
    }

    throw new Error('Timeout waiting for generation');
};

// Get image URL from ComfyUI
const getImageUrl = (image) => {
    const params = new URLSearchParams({
        filename: image.filename,
        subfolder: image.subfolder,
        type: image.type
    });
    return `${CONFIG.API_URL}/view?${params.toString()}`;
};

// Download and save image locally
const downloadImage = async (url, filename) => {
    const outputDir = path.join(process.cwd(), 'storage', 'generated');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const resp = await axios.get(url, { responseType: 'arraybuffer' });
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, resp.data);

    return `/api/comfyui/image/${filename}`;
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

    urls.forEach((url) => {
        if (!url) return;

        const entry = {
            file: url,
            createdAt: new Date().toISOString(),
            source: 'comfyui',
            ...meta
        };
        gallery.unshift(entry);
    });

    // Keep latest 200 entries
    writeGallery(gallery.slice(0, 200));
    return urls;
};

export async function POST(request) {
    try {
        const body = await request.json();
        const opts = {
            prompt: body.prompt?.toString() || 'A cinematic landscape at sunset, ultra-detailed',
            negative: body.negative?.toString() || 'low quality, blurry, artifacts, watermark, text, logo',
            steps: Number(body.steps || 20),
            cfg: Number(body.cfg || 4),
            width: Number(body.width || 768),
            height: Number(body.height || 768),
            batch: Number(body.batch || 4),
            seed: body.seed === 'random' || body.seed === undefined ? Math.floor(Math.random() * 1e15) : Number(body.seed),
            model: body.model?.toString() || 'illustrious-unholy-nswf.safetensors'
        };

        const clientId = generateClientId();
        const workflow = loadWorkflow(opts);
        const promptId = await queuePrompt(workflow, clientId);

        console.log(`ComfyUI task queued: ${promptId}`);

        // Poll for completion
        const images = await pollForCompletion(promptId);

        // Download images locally and get local URLs
        const imageUrls = [];
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            const remoteUrl = getImageUrl(img);

            // Download and serve locally
            const ext = img.filename.split('.').pop() || 'webp';
            const localFilename = `${Date.now()}_${opts.seed}_${i}.${ext}`;
            const localUrl = await downloadImage(remoteUrl, localFilename);
            imageUrls.push(localUrl);
        }

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

        return NextResponse.json({
            files: imageUrls,
            promptId: promptId,
            seed: opts.seed
        });
    } catch (err) {
        console.error('ComfyUI API error:', err.message);
        return NextResponse.json({ message: err.message }, { status: 500 });
    }
}

// GET endpoint to check status or get queue info
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action') || 'queue';

        if (action === 'queue') {
            const resp = await axios.get(`${CONFIG.API_URL}/queue`);
            return NextResponse.json(resp.data);
        }

        if (action === 'history') {
            const promptId = searchParams.get('prompt_id');
            if (promptId) {
                const history = await getHistory(promptId);
                return NextResponse.json(history);
            }
            const resp = await axios.get(`${CONFIG.API_URL}/history`);
            return NextResponse.json(resp.data);
        }

        if (action === 'system') {
            const resp = await axios.get(`${CONFIG.API_URL}/system_stats`);
            return NextResponse.json(resp.data);
        }

        return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
    } catch (err) {
        console.error('ComfyUI GET error:', err.message);
        return NextResponse.json({ message: err.message }, { status: 500 });
    }
}
