import { App } from 'obsidian';
import { MediaFile } from '../types';
import { formatFileSize, formatDate } from '../utils/files';

const PAGE_SIZE = 25;

/** Only one inline player may sound at a time. */
let activeMedia: HTMLMediaElement | null = null;

function trackPlayback(media: HTMLMediaElement): void {
	media.addEventListener('play', () => {
		if (activeMedia && activeMedia !== media) activeMedia.pause();
		activeMedia = media;
	});
}

/** Pause every inline player under `container`. Call before emptying it. */
export function stopAllMedia(container: HTMLElement): void {
	container.querySelectorAll<HTMLMediaElement>('video, audio').forEach(m => m.pause());
	activeMedia = null;
}

/**
 * Thumbnail that doubles as a play button: a poster frame for video, a note
 * glyph for audio. Selecting it expands an inline player below the row.
 */
function createMediaPreview(
	entry: HTMLElement,
	row: HTMLElement,
	mediaFile: MediaFile,
	app: App,
): void {
	const src = app.vault.getResourcePath(mediaFile.file);

	const trigger = row.createDiv({ cls: 'media-review-preview-trigger' });
	trigger.setAttribute('aria-label', `Play ${mediaFile.name}`);

	if (mediaFile.isVideo) {
		const poster = trigger.createEl('video', { cls: 'media-review-thumbnail' });
		poster.muted = true;
		poster.playsInline = true;
		poster.preload = 'metadata';
		// Media fragment nudges the decoder past a possibly black first frame.
		poster.src = `${src}#t=0.1`;
		poster.addEventListener('error', () => {
			poster.remove();
			trigger.createDiv({ cls: 'media-review-icon', text: '\uD83C\uDFA5' });
		});
	} else {
		trigger.createDiv({ cls: 'media-review-icon', text: '\uD83C\uDFB5' });
	}

	trigger.createDiv({ cls: 'media-review-play-badge', text: '\u25B6' });

	const playerEl = entry.createDiv({ cls: 'media-review-player' });
	let media: HTMLVideoElement | HTMLAudioElement | null = null;

	trigger.addEventListener('click', (evt) => {
		evt.preventDefault();
		evt.stopPropagation();

		if (!media) {
			media = mediaFile.isVideo
				? playerEl.createEl('video', { cls: 'media-review-player-el' })
				: playerEl.createEl('audio', { cls: 'media-review-player-el' });
			media.controls = true;
			media.preload = 'metadata';
			media.src = src;
			trackPlayback(media);
		}

		if (entry.hasClass('is-expanded')) {
			media.pause();
			entry.removeClass('is-expanded');
		} else {
			entry.addClass('is-expanded');
			void media.play().catch(() => { /* leave it to the user's play button */ });
		}
	});
}

export function createFileRow(
	containerEl: HTMLElement,
	mediaFile: MediaFile,
	app: App,
	onToggle: (checked: boolean) => void,
	showPreview = false,
): HTMLElement {
	const entry = containerEl.createDiv({ cls: 'media-review-file-entry' });
	const row = entry.createDiv({ cls: 'media-review-file-row' });

	const checkbox = row.createEl('input', { type: 'checkbox' });
	checkbox.addClass('media-review-checkbox');
	checkbox.addEventListener('change', () => onToggle(checkbox.checked));

	if (showPreview && mediaFile.isImage) {
		const thumb = row.createEl('img', { cls: 'media-review-thumbnail' });
		thumb.src = app.vault.getResourcePath(mediaFile.file);
		thumb.alt = mediaFile.name;
	} else if (showPreview && (mediaFile.isVideo || mediaFile.isAudio)) {
		createMediaPreview(entry, row, mediaFile, app);
	} else {
		const icon = row.createDiv({ cls: 'media-review-icon' });
		icon.setText(
			mediaFile.isVideo ? '\uD83C\uDFA5'
				: mediaFile.isAudio ? '\uD83C\uDFB5'
					: '\uD83D\uDDBC\uFE0F',
		);
	}

	const info = row.createDiv({ cls: 'media-review-file-info' });
	info.createDiv({ cls: 'media-review-file-name', text: mediaFile.name });
	const meta = info.createDiv({ cls: 'media-review-file-meta' });
	meta.createSpan({ text: formatFileSize(mediaFile.size) });
	meta.createSpan({ text: ' \u00B7 ' });
	meta.createSpan({ text: formatDate(mediaFile.mtime) });

	return entry;
}

export interface PaginatedList {
	render: () => void;
}

export function createPaginatedFileList(
	containerEl: HTMLElement,
	files: MediaFile[],
	app: App,
	selected: Set<string>,
	showPreview: boolean,
	onSelectionChange?: () => void,
): PaginatedList {
	let page = 0;
	const totalPages = Math.max(1, Math.ceil(files.length / PAGE_SIZE));

	function render(): void {
		stopAllMedia(containerEl);
		containerEl.empty();

		if (files.length === 0) {
			containerEl.createDiv({ text: 'No files found.', cls: 'media-review-empty' });
			return;
		}

		const start = page * PAGE_SIZE;
		const end = Math.min(start + PAGE_SIZE, files.length);
		const pageFiles = files.slice(start, end);

		for (const mf of pageFiles) {
			const entry = createFileRow(containerEl, mf, app, (checked) => {
				if (checked) selected.add(mf.file.path);
				else selected.delete(mf.file.path);
				if (onSelectionChange) onSelectionChange();
			}, showPreview);

			// Restore checkbox state for already-selected files
			if (selected.has(mf.file.path)) {
				const cb = entry.querySelector<HTMLInputElement>('.media-review-checkbox');
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
	wrapper.addClass('is-hidden');

	const label = wrapper.createDiv({ cls: 'media-review-progress-label' });
	const track = wrapper.createDiv({ cls: 'media-review-progress-track' });
	const fill = track.createDiv({ cls: 'media-review-progress-fill' });

	return {
		el: wrapper,
		update(percent: number, text: string) {
			wrapper.removeClass('is-hidden');
			label.setText(text);
			fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
		},
		hide() {
			wrapper.addClass('is-hidden');
		},
	};
}

export function setAllCheckboxes(container: HTMLElement, checked: boolean): void {
	container.querySelectorAll<HTMLInputElement>('.media-review-checkbox').forEach(cb => {
		cb.checked = checked;
		cb.dispatchEvent(new Event('change'));
	});
}
