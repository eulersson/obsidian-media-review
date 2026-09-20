import { Platform, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, MediaReviewSettings, MediaReviewSettingTab } from './settings';
import { RenameModal } from './ui/rename-modal';
import { CompressModal } from './ui/compress-modal';
import { detectSystemTools } from './utils/platform';

export default class MediaReviewPlugin extends Plugin {
	settings: MediaReviewSettings = DEFAULT_SETTINGS;
	ffmpegPath: string | null = null;
	magickPath: string | null = null;
	sipsPath: string | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		if (Platform.isDesktop) {
			detectSystemTools(this.settings.ffmpegPath).then(tools => {
				this.ffmpegPath = tools.ffmpegPath;
				this.magickPath = tools.magickPath;
				this.sipsPath = tools.sipsPath;
			});
		}

		this.addCommand({
			id: 'compress-media',
			name: 'Compress media',
			icon: 'shrink',
			callback: () => new CompressModal(this.app, this).open(),
		});

		this.addCommand({
			id: 'batch-rename',
			name: 'Batch rename attachments',
			icon: 'folder-pen',
			callback: () => new RenameModal(this.app, this).open(),
		});

		this.addSettingTab(new MediaReviewSettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		const data = await this.loadData() as Partial<MediaReviewSettings> & { videoMaxHeight?: number };
		// Pre-0.x setting: the cap used to apply to height only, now to the shorter edge.
		if (data?.videoMaxHeight !== undefined && data.videoMaxShortEdge === undefined) {
			data.videoMaxShortEdge = data.videoMaxHeight;
			delete data.videoMaxHeight;
		}
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
