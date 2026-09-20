import { App, TFile } from 'obsidian';
import type { AudioCompressionOptions } from '../types';
import { getVaultBasePath } from '../utils/platform';

export async function compressAudio(
	app: App,
	file: TFile,
	options: AudioCompressionOptions,
	ffmpegPath: string,
): Promise<{ originalSize: number; newSize: number }> {
	const path = require('path') as typeof import('path');
	const fs = require('fs') as typeof import('fs');
	const { execFile } = require('child_process') as typeof import('child_process');
	const { promisify } = require('util') as typeof import('util');
	const execFileAsync = promisify(execFile);

	const originalExt = file.extension.toLowerCase();
	const newPath = file.path.replace(/\.[^.]+$/, '.mp3');

	// Fail before encoding if converting would clobber an existing file
	if (originalExt !== 'mp3' && app.vault.getAbstractFileByPath(newPath)) {
		throw new Error(`"${newPath}" already exists`);
	}

	const basePath = getVaultBasePath(app);
	const inputPath = path.join(basePath, file.path);
	const tempOutput = inputPath.replace(/(\.[^.]+)$/, '_compressed.mp3');

	const originalSize = file.stat.size;

	const args = [
		'-i', inputPath,
		'-c:a', 'libmp3lame',
		'-b:a', options.bitrate,
	];

	if (options.mono) {
		args.push('-ac', '1');
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

			// If original wasn't mp3, we need to rename + write
			if (originalExt !== 'mp3') {
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
