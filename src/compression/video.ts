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

	// Scale down if a short-edge cap is set. The cap applies to the shorter edge:
	// height for landscape, width for portrait — so 720 means 720p either way.
	// -2 lets the other edge follow the aspect ratio, rounded to a multiple of 2
	// (required by libx264). Expressions are quoted so their commas aren't read as
	// filtergraph separators.
	if (options.maxShortEdge > 0) {
		const cap = options.maxShortEdge;
		args.push(
			'-vf',
			`scale='if(gt(iw,ih),-2,min(${cap},iw))':'if(gt(iw,ih),min(${cap},ih),-2)'`,
		);
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
