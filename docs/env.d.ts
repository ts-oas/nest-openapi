/// <reference types="vite/client" />
import 'vitepress';

declare module '*.vue' {
	import type { DefineComponent } from 'vue';
	const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>;
	export default component;
}

declare module 'vitepress-plugin-llms/vitepress-components/CopyOrDownloadAsMarkdownButtons.vue' {
	import type { DefineComponent } from 'vue';
	const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>;
	export default component;
}

declare module 'vitepress' {
	namespace DefaultTheme {
		interface Config {
			llms?: {
				copyText?: string;
				copiedText?: string;
				viewMarkdownText?: string;
				openInAIText?: string;
			};
		}
	}
}
