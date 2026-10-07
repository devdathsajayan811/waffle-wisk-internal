import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../config.js';
import { HttpError } from '../lib/http.js';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export const allowedImageTypes = Object.keys(EXTENSIONS);

/** Stores an uploaded image and returns the URL clients should use to display it. */
export async function storeImage(buffer: Buffer, contentType: string): Promise<string> {
  const filename = `product-${randomUUID()}${EXTENSIONS[contentType] ?? '.jpg'}`;

  if (config.blobToken) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`products/${filename}`, buffer, {
      access: 'public',
      contentType,
      token: config.blobToken,
    });
    return blob.url;
  }

  if (config.isVercel) {
    throw new HttpError(503, 'Image uploads need BLOB_READ_WRITE_TOKEN (Vercel Blob) to be configured.');
  }

  await fs.mkdir(config.uploadsDir, { recursive: true });
  await fs.writeFile(path.join(config.uploadsDir, filename), buffer);
  return `/uploads/${filename}`;
}
