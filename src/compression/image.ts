import { App, TFile } from 'obsidian';
import type { CompressionOptions, CompressionResult, OutputFormat } from '../types';
import { getVaultBasePath } from '../utils/platform';

/**
 * Compress an image using ImageMagick (best quality), sips (macOS fallback),
 * or Canvas API (mobile/last resort).
 */
export async function compressImage(
	app: App,
	file: TFile,
	options: CompressionOptions,
	magickPath: string | null,
	sipsPath: string | null,
): Promise<CompressionResult> {
	const originalSize = file.stat.size;
	const outputExt = resolveOutputExtension(file.extension, options.outputFormat);

	if (magickPath) {
		return compressWithMagick(app, file, options, outputExt, originalSize, magickPath);
	}

	if (sipsPath) {
		return compressWithSips(app, file, options, outputExt, originalSize, sipsPath);
	}

	return compressWithCanvas(app, file, options, outputExt, originalSize);
}

// ── ImageMagick ──────────────────────────────────────────────────────

async function compressWithMagick(
	app: App,
	file: TFile,
	options: CompressionOptions,
	outputExt: string,
	originalSize: number,
	magickPath: string,
): Promise<CompressionResult> {
	const path = require('path') as typeof import('path');
	const fs = require('fs') as typeof import('fs');
	const { execFile } = require('child_process') as typeof import('child_process');
	const { promisify } = require('util') as typeof import('util');
	const execFileAsync = promisify(execFile);

	const basePath = getVaultBasePath(app);
	const inputPath = path.join(basePath, file.path);
	const tempOutput = inputPath.replace(/(\.[^.]+)$/, `_magick.${outputExt}`);

	const args: string[] = [inputPath];

	// High-quality Lanczos resampling
	args.push('-filter', 'Lanczos');

	// Scaling
	if (options.maxWidth > 0) {
		args.push('-resize', `${options.maxWidth}x>`);
		// Subtle sharpening after downscale (similar to Photoshop Bicubic Sharper)
		args.push('-unsharp', '0x0.5+0.5+0.05');
	}

	// Quality (applies to JPEG, WebP; ignored by PNG)
	args.push('-quality', String(options.quality));

	// Strip metadata to save space
	args.push('-strip');

	// For JPEG: use 4:2:0 chroma subsampling (standard for web)
	if (outputExt === 'jpeg' || outputExt === 'jpg') {
		args.push('-sampling-factor', '4:2:0');
		args.push('-interlace', 'Plane'); // progressive JPEG
	}

	args.push(tempOutput);

	try {
		await execFileAsync(magickPath, args, { timeout: 60_000 });

		const compressedData = fs.readFileSync(tempOutput);
		const data = compressedData.buffer.slice(
			compressedData.byteOffset,
			compressedData.byteOffset + compressedData.byteLength,
		);

		return { file, originalSize, newSize: data.byteLength, newExtension: outputExt, data };
	} finally {
		try { fs.unlinkSync(tempOutput); } catch { /* noop */ }
	}
}

// ── sips (macOS built-in) ────────────────────────────────────────────

async function compressWithSips(
	app: App,
	file: TFile,
	options: CompressionOptions,
	outputExt: string,
	originalSize: number,
	sipsPath: string,
): Promise<CompressionResult> {
	const path = require('path') as typeof import('path');
	const fs = require('fs') as typeof import('fs');
	const { execFile } = require('child_process') as typeof import('child_process');
	const { promisify } = require('util') as typeof import('util');
	const execFileAsync = promisify(execFile);

	const basePath = getVaultBasePath(app);
	const inputPath = path.join(basePath, file.path);
	const tempOutput = inputPath.replace(/(\.[^.]+)$/, `_sips.${outputExt}`);

	// sips uses format names like jpeg, png, gif
	const sipsFormat = outputExt === 'jpg' ? 'jpeg' : outputExt;

	// Copy source to temp first (sips modifies in place or outputs)
	fs.copyFileSync(inputPath, tempOutput);

	const args: string[] = [
		'-s', 'format', sipsFormat,
	];

	// Quality for JPEG
	if (sipsFormat === 'jpeg' || sipsFormat === 'webp') {
		args.push('-s', 'formatOptions', String(options.quality));
	}

	// Scaling
	if (options.maxWidth > 0) {
		args.push('--resampleWidth', String(options.maxWidth));
	}

	args.push(tempOutput);

	try {
		await execFileAsync(sipsPath, args, { timeout: 60_000 });

		const compressedData = fs.readFileSync(tempOutput);
		const data = compressedData.buffer.slice(
			compressedData.byteOffset,
			compressedData.byteOffset + compressedData.byteLength,
		);

		return { file, originalSize, newSize: data.byteLength, newExtension: outputExt, data };
	} finally {
		try { fs.unlinkSync(tempOutput); } catch { /* noop */ }
	}
}

// ── Canvas API (mobile fallback) ─────────────────────────────────────

async function compressWithCanvas(
	app: App,
	file: TFile,
	options: CompressionOptions,
	outputExt: string,
	originalSize: number,
): Promise<CompressionResult> {
	const MIME_TYPES: Record<string, string> = {
		jpeg: 'image/jpeg', jpg: 'image/jpeg',
		png: 'image/png', webp: 'image/webp',
	};

	const buffer = await app.vault.readBinary(file);
	const img = await loadImage(buffer, file.extension);

	let width = img.naturalWidth;
	let height = img.naturalHeight;
	if (options.maxWidth > 0 && width > options.maxWidth) {
		const ratio = options.maxWidth / width;
		width = options.maxWidth;
		height = Math.round(height * ratio);
	}

	const mime = MIME_TYPES[outputExt] ?? 'image/jpeg';
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;

	if (mime === 'image/jpeg') {
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, width, height);
	}

	ctx.drawImage(img, 0, 0, width, height);

	const quality = mime === 'image/png' ? undefined : options.quality / 100;
	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			b => b ? resolve(b) : reject(new Error('canvas.toBlob returned null')),
			mime, quality,
		);
	});

	const data = await blob.arrayBuffer();
	return { file, originalSize, newSize: data.byteLength, newExtension: outputExt, data };
}

function loadImage(buffer: ArrayBuffer, extension: string): Promise<HTMLImageElement> {
	const MIME_TYPES: Record<string, string> = {
		jpeg: 'image/jpeg', jpg: 'image/jpeg',
		png: 'image/png', webp: 'image/webp',
	};
	return new Promise((resolve, reject) => {
		const blob = new Blob([buffer], { type: MIME_TYPES[extension.toLowerCase()] ?? 'image/png' });
		const url = URL.createObjectURL(blob);
		const img = new Image();
		img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
		img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Failed to load image`)); };
		img.src = url;
	});
}

function resolveOutputExtension(originalExt: string, format: OutputFormat): string {
	if (format === 'keep') {
		const ext = originalExt.toLowerCase();
		return ext === 'jpg' ? 'jpeg' : ext;
	}
	return format;
}

export function canCompress(extension: string): boolean {
	const ext = extension.toLowerCase();
	return ['png', 'jpg', 'jpeg', 'bmp', 'webp', 'avif'].includes(ext);
}
