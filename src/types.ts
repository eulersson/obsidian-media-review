import { TFile } from 'obsidian';

export interface MediaFile {
	file: TFile;
	name: string;
	extension: string;
	size: number;
	mtime: number;
	isImage: boolean;
	isVideo: boolean;
}

export type OutputFormat = 'jpeg' | 'webp' | 'png' | 'keep';

export interface CompressionOptions {
	outputFormat: OutputFormat;
	quality: number;       // 0-100
	maxWidth: number;      // pixels, 0 = no resize
}

export type VideoPreset = 'ultrafast' | 'veryfast' | 'fast' | 'medium' | 'slow' | 'veryslow';

export interface VideoCompressionOptions {
	crf: number;           // 0-51
	preset: VideoPreset;
	audioBitrate: string;  // e.g. '128k'
	maxHeight: number;     // 0 = no scaling, 720, 1080, etc.
}

export type SuffixMode = 'keep-name' | 'generate-numbers';

export interface RenameOptions {
	prefix: string;
	suffixMode: SuffixMode;
}

export interface CompressionResult {
	file: TFile;
	originalSize: number;
	newSize: number;
	newExtension: string;
	data: ArrayBuffer;
}
