import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
						'manifest.json'
					]
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		// Desktop-only code paths shell out to ffmpeg/ImageMagick through Node
		// builtins. These are loaded lazily via require() on purpose: a top-level
		// import would break the bundle on mobile, where these paths never run.
		files: ['src/compression/*.ts', 'src/utils/platform.ts'],
		rules: {
			'import/no-nodejs-modules': 'off',
			'@typescript-eslint/no-require-imports': 'off',
			'no-undef': 'off',
		},
	},
	{
		// Every string this rule flags starts with a format name or acronym that is
		// already correctly cased (WebP, JPEG, MP3, CRF, ffmpeg). The heuristic reads
		// those as title case; rewriting them would make the UI text wrong.
		rules: {
			'obsidianmd/ui/sentence-case': 'off',
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"versions.json",
		"main.js",
	]),
);
