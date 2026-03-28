import { Platform } from 'obsidian';

export interface SystemTools {
	ffmpegPath: string | null;
	magickPath: string | null;
	sipsPath: string | null;
}

export async function detectSystemTools(customFfmpegPath?: string): Promise<SystemTools> {
	if (!Platform.isDesktop) {
		return { ffmpegPath: null, magickPath: null, sipsPath: null };
	}

	const [ffmpegPath, magickPath, sipsPath] = await Promise.all([
		detectBinary(customFfmpegPath, 'ffmpeg', [
			'/usr/local/bin/ffmpeg',
			'/opt/homebrew/bin/ffmpeg',
			'/usr/bin/ffmpeg',
		]),
		detectBinary(undefined, 'magick', [
			'/usr/local/bin/magick',
			'/opt/homebrew/bin/magick',
			'/usr/bin/magick',
		]),
		detectBinary(undefined, 'sips', ['/usr/bin/sips']),
	]);

	return { ffmpegPath, magickPath, sipsPath };
}

// Keep backward compat
export async function detectFfmpeg(customPath?: string): Promise<string | null> {
	return detectBinary(customPath, 'ffmpeg', [
		'/usr/local/bin/ffmpeg',
		'/opt/homebrew/bin/ffmpeg',
		'/usr/bin/ffmpeg',
	]);
}

async function detectBinary(
	customPath: string | undefined,
	name: string,
	commonPaths: string[],
): Promise<string | null> {
	if (!Platform.isDesktop) return null;

	if (customPath) {
		if (await testBinary(customPath)) return customPath;
	}

	try {
		const { execFile } = require('child_process') as typeof import('child_process');
		const { promisify } = require('util') as typeof import('util');
		const { stdout } = await promisify(execFile)('which', [name]);
		const p = stdout.trim();
		if (p) return p;
	} catch {
		// not in PATH
	}

	for (const p of commonPaths) {
		if (await testBinary(p)) return p;
	}

	return null;
}

async function testBinary(path: string): Promise<boolean> {
	const { execFile } = require('child_process') as typeof import('child_process');
	const { promisify } = require('util') as typeof import('util');
	const run = promisify(execFile);
	// Try -version first (ffmpeg), then --version (magick), then --help (sips)
	for (const flag of ['-version', '--version', '--help']) {
		try {
			await run(path, [flag]);
			return true;
		} catch {
			// try next flag
		}
	}
	return false;
}

export function getVaultBasePath(app: import('obsidian').App): string {
	return (app.vault.adapter as any).basePath as string;
}
