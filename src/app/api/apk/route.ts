import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apkPath = path.join(process.cwd(), 'release', 'medscript-opd-v1.1.1.apk');

  if (!fs.existsSync(apkPath)) {
    return new NextResponse('APK file not found on server.', { status: 404 });
  }

  const fileBuffer = fs.readFileSync(apkPath);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="medscript-opd-v1.1.1.apk"',
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'no-store, must-revalidate',
    },
  });
}
