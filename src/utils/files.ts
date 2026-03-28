import { App, TFile } from 'obsidian';
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, ALL_MEDIA_EXTENSIONS } from '../constants';
import { MediaFile } from '../types';

export function getMediaFiles(app: App, extensions?: string[]): MediaFile[] {
	const exts = extensions ?? ALL_MEDIA_EXTENSIONS;
	return app.vault.getFiles()
		.filter(f => exts.includes(f.extension.toLowerCase()))
		.map(f => toMediaFile(f))
		.sort((a, b) => b.mtime - a.mtime);
}

function toMediaFile(file: TFile): MediaFile {
	const ext = file.extension.toLowerCase();
	return {
		file,
		name: file.name,
		extension: ext,
		size: file.stat.size,
		mtime: file.stat.mtime,
		isImage: IMAGE_EXTENSIONS.includes(ext),
		isVideo: VIDEO_EXTENSIONS.includes(ext),
	};
}

export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
}
