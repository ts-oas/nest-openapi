import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
// @ts-ignore: vitepress-plugin-llms does not ship type declarations for .vue files
import CopyOrDownloadAsMarkdownButtons from 'vitepress-plugin-llms/vitepress-components/CopyOrDownloadAsMarkdownButtons.vue';
import './style.css';

export default {
	extends: DefaultTheme,
	enhanceApp({ app }) {
		app.component('CopyOrDownloadAsMarkdownButtons', CopyOrDownloadAsMarkdownButtons);
	},
} satisfies Theme;
