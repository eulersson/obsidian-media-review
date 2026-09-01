import { App, Modal, Notice, Setting } from 'obsidian';
import type MediaReviewPlugin from '../main';
import type { MediaFile, SuffixMode } from '../types';
import { getMediaFiles } from '../utils/files';
import { createPaginatedFileList, createSelectAllBar, setAllCheckboxes } from './components';

export class RenameModal extends Modal {
	private plugin: MediaReviewPlugin;
	private mediaFiles: MediaFile[] = [];
	private selected: Set<string> = new Set();
	private prefix = '';
	private suffixMode: SuffixMode = 'generate-numbers';
	private listEl: HTMLElement | null = null;
	private previewEl: HTMLElement | null = null;

	constructor(app: App, plugin: MediaReviewPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass('media-review-modal');
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Batch rename attachments' });

		this.mediaFiles = getMediaFiles(this.app);

		// Options
		const optionsEl = contentEl.createDiv({ cls: 'media-review-options' });

		new Setting(optionsEl)
			.setName('Prefix')
			.setDesc('Text to prepend to each file name')
			.addText(text => {
				text.setPlaceholder('My Topic')
					.setValue(this.prefix)
					.onChange(value => {
						this.prefix = value;
						this.updatePreview();
					});
				// Prevent modal from capturing keystrokes in text input
				text.inputEl.addEventListener('keydown', (e) => e.stopPropagation());
			});

		new Setting(optionsEl)
			.setName('Suffix mode')
			.addDropdown(dd => dd
				.addOption('keep-name', 'Keep original name')
				.addOption('generate-numbers', 'Generate numbers (001, 002...)')
				.setValue(this.suffixMode)
				.onChange(value => {
					this.suffixMode = value as SuffixMode;
					this.updatePreview();
				}));

		// Select bar
		createSelectAllBar(
			contentEl,
			() => setAllCheckboxes(this.listEl!, true),
			() => setAllCheckboxes(this.listEl!, false),
		);

		// File list
		this.listEl = contentEl.createDiv({ cls: 'media-review-file-list' });
		this.renderFileList();

		// Preview
		this.previewEl = contentEl.createDiv({ cls: 'media-review-preview' });

		// Action bar
		const actions = contentEl.createDiv({ cls: 'media-review-actions' });
		const renameBtn = actions.createEl('button', {
			text: 'Rename selected',
			cls: 'mod-cta',
		});
		renameBtn.addEventListener('click', () => this.executeRename());
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderFileList(): void {
		if (!this.listEl) return;

		createPaginatedFileList(
			this.listEl, this.mediaFiles, this.app,
			this.selected, true,
			() => this.updatePreview(),
		);
	}

	private updatePreview(): void {
		if (!this.previewEl) return;
		this.previewEl.empty();

		if (this.selected.size === 0 || !this.prefix.trim()) {
			return;
		}

		this.previewEl.createEl('h4', { text: 'Preview' });
		const table = this.previewEl.createEl('div', { cls: 'media-review-preview-list' });

		const selectedFiles = this.getSelectedFilesInOrder();
		const pad = String(selectedFiles.length).length < 3 ? 3 : String(selectedFiles.length).length;

		for (let i = 0; i < selectedFiles.length; i++) {
			const mf = selectedFiles[i]!;
			const newName = this.computeNewName(mf, i, pad);
			const row = table.createDiv({ cls: 'media-review-preview-row' });
			row.createSpan({ text: mf.name, cls: 'media-review-old-name' });
			row.createSpan({ text: ' \u2192 ', cls: 'media-review-arrow' });
			row.createSpan({ text: newName, cls: 'media-review-new-name' });
		}
	}

	private computeNewName(mf: MediaFile, index: number, pad: number): string {
		const prefix = this.prefix.trim();
		const ext = mf.file.extension;

		if (this.suffixMode === 'keep-name') {
			const baseName = mf.file.basename;
			return `${prefix} ${baseName}.${ext}`;
		} else {
			const num = String(index + 1).padStart(pad, '0');
			return `${prefix} ${num}.${ext}`;
		}
	}

	private getSelectedFilesInOrder(): MediaFile[] {
		return this.mediaFiles.filter(mf => this.selected.has(mf.file.path));
	}

	private async executeRename(): Promise<void> {
		const prefix = this.prefix.trim();
		if (!prefix) {
			new Notice('Please enter a prefix.');
			return;
		}
		if (this.selected.size === 0) {
			new Notice('No files selected.');
			return;
		}

		const selectedFiles = this.getSelectedFilesInOrder();
		const pad = String(selectedFiles.length).length < 3 ? 3 : String(selectedFiles.length).length;

		// Check for conflicts
		const newPaths: string[] = [];
		const existingPaths = new Set(this.app.vault.getFiles().map(f => f.path));

		for (let i = 0; i < selectedFiles.length; i++) {
			const mf = selectedFiles[i]!;
			const newName = this.computeNewName(mf, i, pad);
			const folder = mf.file.parent ? mf.file.parent.path : '';
			const newPath = folder ? `${folder}/${newName}` : newName;

			// Check conflict with existing files not in our selection
			if (existingPaths.has(newPath) && !this.selected.has(newPath)) {
				new Notice(`Conflict: "${newName}" already exists. Aborting.`);
				return;
			}

			// Check conflict within our rename set
			if (newPaths.includes(newPath)) {
				new Notice(`Conflict: two files would be renamed to "${newName}". Aborting.`);
				return;
			}

			newPaths.push(newPath);
		}

		// Execute renames
		let count = 0;
		for (let i = 0; i < selectedFiles.length; i++) {
			const mf = selectedFiles[i]!;
			const newPath = newPaths[i]!;

			try {
				await this.app.fileManager.renameFile(mf.file, newPath);
				count++;
			} catch (e) {
				new Notice(`Failed to rename "${mf.name}": ${e}`);
			}
		}

		new Notice(`Renamed ${count} file${count !== 1 ? 's' : ''}.`);
		this.close();
	}
}
