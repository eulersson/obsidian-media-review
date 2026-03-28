import { App, PluginSettingTab, Setting } from 'obsidian';
import type MediaReviewPlugin from './main';
import type { OutputFormat, VideoPreset } from './types';

export interface MediaReviewSettings {
	imageQuality: number;
	imageMaxWidth: number;
	imageOutputFormat: OutputFormat;
	videoCrf: number;
	videoPreset: VideoPreset;
	videoAudioBitrate: string;
	videoMaxHeight: number;
	ffmpegPath: string;
}

export const DEFAULT_SETTINGS: MediaReviewSettings = {
	imageQuality: 85,
	imageMaxWidth: 1920,
	imageOutputFormat: 'jpeg',
	videoCrf: 23,
	videoPreset: 'slow',
	videoAudioBitrate: '128k',
	videoMaxHeight: 720,
	ffmpegPath: '',
};

export class MediaReviewSettingTab extends PluginSettingTab {
	plugin: MediaReviewPlugin;

	constructor(app: App, plugin: MediaReviewPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h3', { text: 'Image compression defaults' });

		new Setting(containerEl)
			.setName('Output format')
			.setDesc('Default format for compressed images')
			.addDropdown(dd => dd
				.addOption('jpeg', 'JPEG')
				.addOption('webp', 'WebP')
				.addOption('png', 'PNG')
				.addOption('keep', 'Keep original')
				.setValue(this.plugin.settings.imageOutputFormat)
				.onChange(async (value) => {
					this.plugin.settings.imageOutputFormat = value as OutputFormat;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Quality')
			.setDesc('Compression quality (0-100). Only applies to JPEG and WebP.')
			.addSlider(slider => slider
				.setLimits(10, 100, 5)
				.setValue(this.plugin.settings.imageQuality)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.imageQuality = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Max width')
			.setDesc('Scale images wider than this (in pixels). Set to 0 to disable scaling.')
			.addText(text => text
				.setPlaceholder('1920')
				.setValue(String(this.plugin.settings.imageMaxWidth))
				.onChange(async (value) => {
					const num = parseInt(value, 10);
					if (!isNaN(num) && num >= 0) {
						this.plugin.settings.imageMaxWidth = num;
						await this.plugin.saveSettings();
					}
				}));

		containerEl.createEl('h3', { text: 'Video compression defaults' });

		new Setting(containerEl)
			.setName('CRF (quality)')
			.setDesc('Constant rate factor (0-51). Lower = better quality. 23 is high quality for web.')
			.addSlider(slider => slider
				.setLimits(0, 51, 1)
				.setValue(this.plugin.settings.videoCrf)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.videoCrf = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Preset')
			.setDesc('Encoding speed vs compression. Slower = smaller files at same quality.')
			.addDropdown(dd => dd
				.addOption('veryfast', 'Very fast')
				.addOption('fast', 'Fast')
				.addOption('medium', 'Medium')
				.addOption('slow', 'Slow (recommended)')
				.addOption('veryslow', 'Very slow (best compression)')
				.setValue(this.plugin.settings.videoPreset)
				.onChange(async (value) => {
					this.plugin.settings.videoPreset = value as VideoPreset;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Max height')
			.setDesc('Scale videos taller than this (e.g. 720 for 720p, 1080 for 1080p). 0 = no scaling.')
			.addDropdown(dd => dd
				.addOption('0', 'No scaling')
				.addOption('480', '480p')
				.addOption('720', '720p (recommended)')
				.addOption('1080', '1080p')
				.setValue(String(this.plugin.settings.videoMaxHeight))
				.onChange(async (value) => {
					this.plugin.settings.videoMaxHeight = parseInt(value, 10);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Audio bitrate')
			.setDesc('AAC audio bitrate (e.g. 128k)')
			.addText(text => text
				.setPlaceholder('128k')
				.setValue(this.plugin.settings.videoAudioBitrate)
				.onChange(async (value) => {
					this.plugin.settings.videoAudioBitrate = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('ffmpeg path')
			.setDesc('Path to ffmpeg binary. Leave empty for auto-detection.')
			.addText(text => text
				.setPlaceholder('/usr/local/bin/ffmpeg')
				.setValue(this.plugin.settings.ffmpegPath)
				.onChange(async (value) => {
					this.plugin.settings.ffmpegPath = value;
					await this.plugin.saveSettings();
				}));
	}
}
