import { App } from 'obsidian';
import { MediaFile } from '../types';
import { formatFileSize, formatDate } from '../utils/files';

const PAGE_SIZE = 25;

export function createFileRow(
	containerEl: HTMLElement,
	mediaFile: MediaFile,
	app: App,
	onToggle: (checked: boolean) => void,
	showThumbnail = false,
): HTMLElement {
	const row = containerEl.createDiv({ cls: 'media-review-file-row' });

	const checkbox = row.createEl('input', { type: 'checkbox' });
	checkbox.addClass('media-review-checkbox');
	checkbox.addEventListener('change', () => onToggle(checkbox.checked));

	if (showThumbnail && mediaFile.isImage) {
		const thumb = row.createEl('img', { cls: 'media-review-thumbnail' });
		thumb.src = app.vault.getResourcePath(mediaFile.file);
		thumb.alt = mediaFile.name;
	} else {
		const icon = row.createDiv({ cls: 'media-review-icon' });
		icon.setText(mediaFile.isVideo ? '\uD83C\uDFA5' : '\uD83D\uDDBC\uFE0F');
	}

	const info = row.createDiv({ cls: 'media-review-file-info' });
	info.createDiv({ cls: 'media-review-file-name', text: mediaFile.name });
	const meta = info.createDiv({ cls: 'media-review-file-meta' });
	meta.createSpan({ text: formatFileSize(mediaFile.size) });
	meta.createSpan({ text: ' \u00B7 ' });
	meta.createSpan({ text: formatDate(mediaFile.mtime) });

	return row;
}

export interface PaginatedList {
	render: () => void;
}

export function createPaginatedFileList(
	containerEl: HTMLElement,
	files: MediaFile[],
	app: App,
	selected: Set<string>,
	showThumbnail: boolean,
	onSelectionChange?: () => void,
): PaginatedList {
	let page = 0;
	const totalPages = Math.max(1, Math.ceil(files.length / PAGE_SIZE));

	function render(): void {
		containerEl.empty();

		if (files.length === 0) {
			containerEl.createDiv({ text: 'No files found.', cls: 'media-review-empty' });
			return;
		}

		const start = page * PAGE_SIZE;
		const end = Math.min(start + PAGE_SIZE, files.length);
		const pageFiles = files.slice(start, end);

		for (const mf of pageFiles) {
			const row = createFileRow(containerEl, mf, app, (checked) => {
				if (checked) selected.add(mf.file.path);
				else selected.delete(mf.file.path);
				if (onSelectionChange) onSelectionChange();
			}, showThumbnail);

			// Restore checkbox state for already-selected files
			if (selected.has(mf.file.path)) {
				const cb = row.querySelector<HTMLInputElement>('.media-review-checkbox');
				if (cb) cb.checked = true;
			}
		}

		// Pagination controls
		if (totalPages > 1) {
			const nav = containerEl.createDiv({ cls: 'media-review-pagination' });

			const prevBtn = nav.createEl('button', { text: '\u2190 Prev' });
			prevBtn.disabled = page === 0;
			prevBtn.addEventListener('click', () => { page--; render(); });

			nav.createSpan({
				text: `${page + 1} / ${totalPages}`,
				cls: 'media-review-page-info',
			});

			const nextBtn = nav.createEl('button', { text: 'Next \u2192' });
			nextBtn.disabled = page >= totalPages - 1;
			nextBtn.addEventListener('click', () => { page++; render(); });
		}
	}

	render();
	return { render };
}

export function createSelectAllBar(
	containerEl: HTMLElement,
	onSelectAll: () => void,
	onDeselectAll: () => void,
): HTMLElement {
	const bar = containerEl.createDiv({ cls: 'media-review-select-bar' });

	const selectAllBtn = bar.createEl('button', { text: 'Select all' });
	selectAllBtn.addEventListener('click', onSelectAll);

	const deselectAllBtn = bar.createEl('button', { text: 'Deselect all' });
	deselectAllBtn.addEventListener('click', onDeselectAll);

	return bar;
}

export function createProgressBar(containerEl: HTMLElement): {
	el: HTMLElement;
	update: (percent: number, label: string) => void;
	hide: () => void;
} {
	const wrapper = containerEl.createDiv({ cls: 'media-review-progress' });
	wrapper.style.display = 'none';

	const label = wrapper.createDiv({ cls: 'media-review-progress-label' });
	const track = wrapper.createDiv({ cls: 'media-review-progress-track' });
	const fill = track.createDiv({ cls: 'media-review-progress-fill' });

	return {
		el: wrapper,
		update(percent: number, text: string) {
			wrapper.style.display = '';
			label.setText(text);
			fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
		},
		hide() {
			wrapper.style.display = 'none';
		},
	};
}

export function setAllCheckboxes(container: HTMLElement, checked: boolean): void {
	container.querySelectorAll<HTMLInputElement>('.media-review-checkbox').forEach(cb => {
		cb.checked = checked;
		cb.dispatchEvent(new Event('change'));
	});
}
