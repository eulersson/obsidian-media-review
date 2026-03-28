import { App, TFile } from 'obsidian';
import type { VideoCompressionOptions } from '../types';
import { getVaultBasePath } from '../utils/platform';

export async function compressVideo(
	app: App,
	file: TFile,
	options: VideoCompressionOptions,
	ffmpegPath: string,
): Promise<{ originalSize: number; newSize: number }> {
	const path = require('path') as typeof import('path');
	const fs = require('fs') as typeof import('fs');
	const { execFile } = require('child_process') as typeof import('child_process');
	const { promisify } = require('util') as typeof import('util');
	const execFileAsync = promisify(execFile);

	const basePath = getVaultBasePath(app);
	const inputPath = path.join(basePath, file.path);
	const tempOutput = inputPath.replace(/(\.[^.]+)$/, '_compressed.mp4');

	const originalSize = file.stat.size;

	const args = [
		'-i', inputPath,
		'-c:v', 'libx264',
		'-crf', String(options.crf),
		'-preset', options.preset,
		'-c:a', 'aac',
		'-b:a', options.audioBitrate,
		'-pix_fmt', 'yuv420p',
		'-movflags', '+faststart',
	];

	// Scale down if maxHeight is set
	if (options.maxHeight > 0) {
		// -2 ensures width is divisible by 2 (required by libx264)
		args.push('-vf', `scale=-2:min'(${options.maxHeight},ih)'`);
	}

	args.push('-y', tempOutput);

	try {
		await execFileAsync(ffmpegPath, args, {
			timeout: 10 * 60 * 1000,
			maxBuffer: 10 * 1024 * 1024,
		});

		const compressedData = fs.readFileSync(tempOutput);
		const newSize = compressedData.byteLength;

		if (newSize < originalSize) {
			const arrayBuffer = compressedData.buffer.slice(
				compressedData.byteOffset,
				compressedData.byteOffset + compressedData.byteLength,
			);

			// If original wasn't mp4, we need to rename + write
			const originalExt = file.extension.toLowerCase();
			if (originalExt !== 'mp4') {
				const newPath = file.path.replace(/\.[^.]+$/, '.mp4');
				await app.fileManager.renameFile(file, newPath);
				const renamedFile = app.vault.getAbstractFileByPath(newPath);
				if (renamedFile instanceof TFile) {
					await app.vault.modifyBinary(renamedFile, arrayBuffer);
				}
			} else {
				await app.vault.modifyBinary(file, arrayBuffer);
			}
		}

		return { originalSize, newSize };
	} finally {
		try { fs.unlinkSync(tempOutput); } catch { /* noop */ }
	}
}
