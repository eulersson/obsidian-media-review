import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import type MediaReviewPlugin from '../main';
import type { CompressionOptions, MediaFile, OutputFormat, VideoCompressionOptions, VideoPreset } from '../types';
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from '../constants';
import { getMediaFiles, formatFileSize } from '../utils/files';
import { compressImage, canCompress } from '../compression/image';
import { compressVideo } from '../compression/video';
import { createPaginatedFileList, createSelectAllBar, createProgressBar, setAllCheckboxes } from './components';

type Mode = 'images' | 'videos';

export class CompressModal extends Modal {
	private plugin: MediaReviewPlugin;
	private mode: Mode = 'images';
	private mediaFiles: MediaFile[] = [];
	private selected: Set<string> = new Set();
	private listEl: HTMLElement | null = null;
	private optionsEl: HTMLElement | null = null;
	private selectBarEl: HTMLElement | null = null;
	private imageOptions: CompressionOptions;
	private videoOptions: VideoCompressionOptions;

	// Quality UI refs for reactive enable/disable
	private qualitySetting: Setting | null = null;
	private qualityNote: HTMLElement | null = null;

	constructor(app: App, plugin: MediaReviewPlugin) {
		super(app);
		this.plugin = plugin;
		this.imageOptions = {
			outputFormat: plugin.settings.imageOutputFormat,
			quality: plugin.settings.imageQuality,
			maxWidth: plugin.settings.imageMaxWidth,
		};
		this.videoOptions = {
			crf: plugin.settings.videoCrf,
			preset: plugin.settings.videoPreset,
			audioBitrate: plugin.settings.videoAudioBitrate,
			maxHeight: plugin.settings.videoMaxHeight,
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass('media-review-modal');
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Compress media' });

		// Mode toggle
		const toggleBar = contentEl.createDiv({ cls: 'media-review-mode-toggle' });
		const imgBtn = toggleBar.createEl('button', { text: 'Images', cls: 'media-review-mode-btn is-active' });
		const vidBtn = toggleBar.createEl('button', { text: 'Videos', cls: 'media-review-mode-btn' });

		if (!this.plugin.ffmpegPath) {
			vidBtn.disabled = true;
			vidBtn.title = 'ffmpeg not found';
			vidBtn.addClass('media-review-mode-btn-disabled');
		}

		imgBtn.addEventListener('click', () => {
			if (this.mode === 'images') return;
			this.mode = 'images';
			imgBtn.addClass('is-active');
			vidBtn.removeClass('is-active');
			this.selected.clear();
			this.rebuildOptions();
			this.renderFileList();
		});

		vidBtn.addEventListener('click', () => {
			if (this.mode === 'videos' || !this.plugin.ffmpegPath) return;
			this.mode = 'videos';
			vidBtn.addClass('is-active');
			imgBtn.removeClass('is-active');
			this.selected.clear();
			this.rebuildOptions();
			this.renderFileList();
		});

		// Options container (rebuilt on mode switch)
		this.optionsEl = contentEl.createDiv({ cls: 'media-review-options' });
		this.rebuildOptions();

		// Select bar
		this.selectBarEl = contentEl.createDiv();
		createSelectAllBar(
			this.selectBarEl,
			() => setAllCheckboxes(this.listEl!, true),
			() => setAllCheckboxes(this.listEl!, false),
		);

		// File list
		this.listEl = contentEl.createDiv({ cls: 'media-review-file-list' });
		this.mediaFiles = getMediaFiles(this.app);
		this.renderFileList();

		// Progress + actions
		const progress = createProgressBar(contentEl);

		const actions = contentEl.createDiv({ cls: 'media-review-actions' });
		const compressBtn = actions.createEl('button', {
			text: 'Compress selected',
			cls: 'mod-cta',
		});
		compressBtn.addEventListener('click', () => this.executeCompression(compressBtn, progress));
	}

	onClose(): void {
		this.contentEl.empty();
	}

	// ── Options panel ────────────────────────────────────────────────

	private rebuildOptions(): void {
		if (!this.optionsEl) return;
		this.optionsEl.empty();
		this.qualitySetting = null;
		this.qualityNote = null;

		if (this.mode === 'images') {
			this.buildImageOptions(this.optionsEl);
		} else {
			this.buildVideoOptions(this.optionsEl);
		}
	}

	private buildImageOptions(el: HTMLElement): void {
		new Setting(el)
			.setName('Output format')
			.addDropdown(dd => dd
				.addOption('jpeg', 'JPEG')
				.addOption('webp', 'WebP')
				.addOption('png', 'PNG (lossless, no quality control)')
				.addOption('keep', 'Keep original')
				.setValue(this.imageOptions.outputFormat)
				.onChange(value => {
					this.imageOptions.outputFormat = value as OutputFormat;
					this.updateQualityState();
				}));

		this.qualitySetting = new Setting(el)
			.setName('Quality')
			.addSlider(slider => slider
				.setLimits(10, 100, 5)
				.setValue(this.imageOptions.quality)
				.setDynamicTooltip()
				.onChange(value => {
					this.imageOptions.quality = value;
				}));

		this.qualityNote = el.createDiv({ cls: 'media-review-quality-note' });
		this.updateQualityState();

		new Setting(el)
			.setName('Max width (px)')
			.setDesc('0 = no scaling')
			.addText(text => {
				text.setValue(String(this.imageOptions.maxWidth))
					.onChange(value => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 0) this.imageOptions.maxWidth = num;
					});
				text.inputEl.addEventListener('keydown', (e) => e.stopPropagation());
			});
	}

	private buildVideoOptions(el: HTMLElement): void {
		new Setting(el)
			.setName('CRF (quality)')
			.setDesc('0-51. Lower = better quality. 23 is high quality for web.')
			.addSlider(slider => slider
				.setLimits(0, 51, 1)
				.setValue(this.videoOptions.crf)
				.setDynamicTooltip()
				.onChange(value => {
					this.videoOptions.crf = value;
				}));

		new Setting(el)
			.setName('Preset')
			.setDesc('Slower = smaller files at same quality')
			.addDropdown(dd => dd
				.addOption('veryfast', 'Very fast')
				.addOption('fast', 'Fast')
				.addOption('medium', 'Medium')
				.addOption('slow', 'Slow (recommended)')
				.addOption('veryslow', 'Very slow (best compression)')
				.setValue(this.videoOptions.preset)
				.onChange(value => {
					this.videoOptions.preset = value as VideoPreset;
				}));

		new Setting(el)
			.setName('Max resolution')
			.addDropdown(dd => dd
				.addOption('0', 'No scaling')
				.addOption('480', '480p')
				.addOption('720', '720p (recommended)')
				.addOption('1080', '1080p')
				.setValue(String(this.videoOptions.maxHeight))
				.onChange(value => {
					this.videoOptions.maxHeight = parseInt(value, 10);
				}));

		new Setting(el)
			.setName('Audio bitrate')
			.addText(text => {
				text.setValue(this.videoOptions.audioBitrate)
					.onChange(value => {
						this.videoOptions.audioBitrate = value;
					});
				text.inputEl.addEventListener('keydown', (e) => e.stopPropagation());
			});
	}

	private updateQualityState(): void {
		const isPng = this.imageOptions.outputFormat === 'png';
		const isKeep = this.imageOptions.outputFormat === 'keep';

		if (this.qualitySetting) {
			const slider = this.qualitySetting.settingEl.querySelector<HTMLInputElement>('input[type="range"]');
			if (slider) {
				slider.disabled = isPng;
				slider.style.opacity = isPng ? '0.3' : '1';
			}
		}

		if (this.qualityNote) {
			this.qualityNote.empty();
			if (isPng) {
				this.qualityNote.setText('PNG is lossless - quality slider has no effect. Only scaling reduces file size. Use JPEG or WebP for lossy compression.');
			} else if (isKeep) {
				this.qualityNote.setText('PNG source files will stay lossless. Select JPEG or WebP to apply lossy compression to PNGs.');
			}
		}
	}

	// ── File list ────────────────────────────────────────────────────

	private renderFileList(): void {
		if (!this.listEl) return;

		const files = this.mediaFiles.filter(mf => {
			if (this.mode === 'images') return mf.isImage && canCompress(mf.extension);
			return mf.isVideo;
		});

		createPaginatedFileList(
			this.listEl, files, this.app,
			this.selected, this.mode === 'images',
		);
	}

	// ── Compression ──────────────────────────────────────────────────

	private async executeCompression(
		btn: HTMLElement,
		progress: ReturnType<typeof createProgressBar>,
	): Promise<void> {
		if (this.selected.size === 0) {
			new Notice('No files selected.');
			return;
		}

		btn.setAttribute('disabled', 'true');
		const selectedFiles = this.mediaFiles.filter(mf => this.selected.has(mf.file.path));
		let totalSaved = 0;
		let processed = 0;

		for (const mf of selectedFiles) {
			processed++;
			progress.update(
				(processed / selectedFiles.length) * 100,
				`Processing ${processed}/${selectedFiles.length}: ${mf.name}`,
			);

			try {
				if (this.mode === 'images' && mf.isImage && canCompress(mf.extension)) {
					const result = await compressImage(
						this.app, mf.file, this.imageOptions,
						this.plugin.magickPath, this.plugin.sipsPath,
					);

					if (result.newSize >= result.originalSize) {
						new Notice(`Skipped "${mf.name}" - compressed file is not smaller.`);
						continue;
					}

					const saved = result.originalSize - result.newSize;
					totalSaved += saved;
					await this.writeCompressedImage(mf.file, result.data, result.newExtension);
					new Notice(
						`${mf.name}: ${formatFileSize(result.originalSize)} \u2192 ${formatFileSize(result.newSize)} (saved ${formatFileSize(saved)})`,
					);

				} else if (this.mode === 'videos' && mf.isVideo && this.plugin.ffmpegPath) {
					const result = await compressVideo(
						this.app, mf.file, this.videoOptions, this.plugin.ffmpegPath,
					);

					if (result.newSize >= result.originalSize) {
						new Notice(`Skipped "${mf.name}" - compressed file is not smaller.`);
						continue;
					}

					const saved = result.originalSize - result.newSize;
					totalSaved += saved;
					new Notice(
						`${mf.name}: ${formatFileSize(result.originalSize)} \u2192 ${formatFileSize(result.newSize)} (saved ${formatFileSize(saved)})`,
					);
				}
			} catch (e) {
				new Notice(`Failed to compress "${mf.name}": ${e}`);
			}
		}

		progress.update(100, `Done! Saved ${formatFileSize(totalSaved)} total.`);
		btn.removeAttribute('disabled');
	}

	private async writeCompressedImage(
		file: TFile,
		data: ArrayBuffer,
		newExtension: string,
	): Promise<void> {
		const currentExt = file.extension.toLowerCase();
		const normalizedNewExt = newExtension.toLowerCase();

		if (currentExt === normalizedNewExt || (currentExt === 'jpg' && normalizedNewExt === 'jpeg')) {
			await this.app.vault.modifyBinary(file, data);
		} else {
			const newPath = file.path.replace(/\.[^.]+$/, `.${normalizedNewExt}`);
			await this.app.fileManager.renameFile(file, newPath);
			const renamedFile = this.app.vault.getAbstractFileByPath(newPath);
			if (renamedFile instanceof TFile) {
				await this.app.vault.modifyBinary(renamedFile, data);
			}
		}
	}
}
