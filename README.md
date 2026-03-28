# Media Review

An Obsidian plugin to compress, scale, and batch rename media attachments in your vault. Built for content creators who publish via static site generators like Quartz.

## Features

### Image compression

Open the command palette and run **Compress media**, then switch to **Images** mode.

- **Output format**: Convert between JPEG, WebP, PNG, or keep the original format
- **Quality slider**: Control lossy compression level (10-100, default 85)
- **Max width scaling**: Downscale images wider than a threshold (default 1920px)
- **High-quality processing**: Uses ImageMagick with Lanczos resampling and subtle unsharp mask when available, falls back to macOS sips, then browser Canvas API on mobile
- **Link-safe format conversion**: When changing format (e.g. PNG to JPEG), all vault links are automatically updated
- **Smart skip**: Files that wouldn't get smaller are skipped with a notice
- PNG quality note: The UI disables the quality slider and shows a warning when PNG output is selected, since PNG is always lossless

### Video compression

Switch to **Videos** mode in the compress modal (requires ffmpeg installed on your system).

- **CRF quality**: Constant rate factor slider (0-51, default 23 -- high quality for web)
- **Encoding preset**: Speed vs compression tradeoff (veryfast to veryslow, default slow)
- **Resolution scaling**: Downscale to 480p, 720p, or 1080p (default 720p)
- **Audio bitrate**: AAC audio quality (default 128k)
- **Web-optimized output**: Always outputs MP4 with `yuv420p` pixel format and `+faststart` for progressive web playback
- **Auto format conversion**: Non-MP4 sources (MOV, AVI, MKV, WebM) are converted to MP4 with vault links updated

### Batch rename

Run **Batch rename attachments** from the command palette.

- **Prefix**: Add a shared prefix to selected files (e.g. "My Topic")
- **Two suffix modes**:
  - **Keep original name**: `abcd.jpg` becomes `My Topic abcd.jpg`
  - **Generate numbers**: Files become `My Topic 001.jpg`, `My Topic 002.jpg`, etc.
- **Live preview**: See old name -> new name for all selected files before confirming
- **Conflict detection**: Checks for naming collisions before executing
- **Link-safe**: Uses Obsidian's `fileManager.renameFile()` so all `![[...]]` references update automatically

### General

- **Sorted newest-first**: All file lists sort by modification date, newest on top
- **Paginated lists**: 25 files per page with navigation controls
- **Multi-select**: Checkboxes with Select all / Deselect all
- **Image thumbnails**: Preview images inline in the file list
- **Before/after feedback**: Each compressed file shows original size, new size, and bytes saved
- **Settings tab**: Configure persistent defaults for all compression parameters

## Requirements

- **Image compression**: Works on all platforms. Best quality on desktop with [ImageMagick](https://imagemagick.org/) installed (`brew install imagemagick` on macOS)
- **Video compression**: Desktop only. Requires [ffmpeg](https://ffmpeg.org/) installed (`brew install ffmpeg` on macOS)
- Both tools are auto-detected at plugin load. Custom paths can be set in the settings tab.

## Installation

1. Copy `main.js`, `manifest.json`, and `styles.css` to your vault at `.obsidian/plugins/media-review/`
2. Reload Obsidian
3. Enable the plugin under **Settings -> Community plugins**

## Development

```bash
npm install
npm run dev    # watch mode
npm run build  # production build
```
