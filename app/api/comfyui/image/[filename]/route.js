import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
    try {
        const { filename } = params;
        const filePath = path.join(process.cwd(), 'storage', 'generated', filename);

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ message: 'Image not found' }, { status: 404 });
        }

        const fileBuffer = fs.readFileSync(filePath);
        const ext = path.extname(filename).toLowerCase();

        let contentType = 'image/webp';
        if (ext === '.png') contentType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.gif') contentType = 'image/gif';

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000'
            }
        });
    } catch (err) {
        console.error('Image serve error:', err.message);
        return NextResponse.json({ message: err.message }, { status: 500 });
    }
}
