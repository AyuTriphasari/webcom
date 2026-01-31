import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GALLERY_FILE = path.join(process.cwd(), 'storage', 'gallery.json');

const readGallery = () => {
    try {
        return JSON.parse(fs.readFileSync(GALLERY_FILE, 'utf-8'));
    } catch {
        return [];
    }
};

export async function GET() {
    const items = readGallery();
    return NextResponse.json(items);
}
