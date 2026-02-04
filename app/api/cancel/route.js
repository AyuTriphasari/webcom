import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { NextResponse } from 'next/server';

const loadToken = () => {
    const tokenPath = path.join(process.cwd(), 'storage', 'token.json');
    if (!fs.existsSync(tokenPath)) throw new Error('token.json not found');
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    if (!token.access_token) throw new Error('access_token missing in token.json');
    return token.access_token;
};

const createHeaders = (apiKey) => ({
    'Content-Type': 'application/json',
    origin: 'https://www.runninghub.ai',
    referer: 'https://www.runninghub.ai/',
    Authorization: `Bearer ${apiKey}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    'user-language': 'en-US'
});

export async function POST(request) {
    try {
        const { taskId } = await request.json();

        if (!taskId) {
            return NextResponse.json({ message: 'taskId required' }, { status: 400 });
        }

        const apiKey = loadToken();

        const resp = await axios.post(
            'https://www.runninghub.ai/task/cancel',
            { taskId },
            { headers: createHeaders(apiKey) }
        );

        console.log('Cancel response:', resp.data);

        return NextResponse.json({ success: true, data: resp.data });
    } catch (err) {
        console.error('Cancel error:', err.message);
        return NextResponse.json({ message: err.message }, { status: 500 });
    }
}
