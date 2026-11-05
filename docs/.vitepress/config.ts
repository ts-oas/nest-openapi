import { defineConfig } from 'vitepress';
import llmstxt, { copyOrDownloadAsMarkdownButtons } from 'vitepress-plugin-llms';

declare const process: any;
const repo = process?.env?.GITHUB_REPOSITORY?.split('/')[1];
const isOrgSite = repo?.endsWith('.github.io');
const computedBase = isOrgSite ? '/' : repo ? `/${repo}/` : '/';
const base = (process?.env?.DOCS_BASE as string) || computedBase;

export default defineConfig({
	title: '@nest-openapi',
	description: 'Modern, modular OpenAPI utilities for NestJS',
	base,
	cleanUrls: true,
	sitemap: {
		hostname: 'https://nest-openapi.github.io',
	},
	head: [
		['meta', { name: 'theme-color', content: '#111827' }],
		['link', { rel: 'icon', href: `${base}favicon.png` }],
	],
	markdown: {
		config(md) {
			md.use(copyOrDownloadAsMarkdownButtons as any);
		},
	},
	vite: {
		plugins: [llmstxt()],
	},
	themeConfig: {
		logo: { src: `${base}nest-openapi-logo.png`, alt: 'nest-openapi' },
		llms: {
			copyText: 'Copy Markdown',
			copiedText: 'Copied',
			viewMarkdownText: 'View as Markdown',
			openInAIText: 'Open in {provider}',
		},
		nav: [
			{ text: 'Home', link: '/' },
			{ text: 'Validator', link: '/validator/' },
			{ text: 'Serializer', link: '/serializer/' },
			{ text: 'Mock', link: '/mock/' },
			{ text: 'MCP', link: '/mcp/' },
		],
		socialLinks: [
			{ icon: 'github', link: 'https://github.com/ts-oas/nest-openapi' },
		],
		sidebar: {
			'/validator/': [
				{
					text: 'Validator',
					items: [
						{ text: 'Overview', link: '/validator/' },
						{ text: 'Advanced setup', link: '/validator/advanced-setup' },
						{ text: 'Options', link: '/validator/options' },
						{ text: 'Decorators', link: '/validator/decorators' },
						{ text: 'Manual Validation', link: '/validator/manual' },
						{ text: 'Changelog', link: '/validator/changelog' },
					],
				},
			],
			'/serializer/': [
				{
					text: 'Serializer',
					items: [
						{ text: 'Overview', link: '/serializer/' },
						{ text: 'Options', link: '/serializer/options' },
						{ text: 'Decorators', link: '/serializer/decorators' },
						{ text: 'Manual Serialization', link: '/serializer/manual' },
						{ text: 'Changelog', link: '/serializer/changelog' },
					],
				},
			],
			'/mock/': [
				{
					text: 'Mock',
					items: [
						{ text: 'Overview', link: '/mock/' },
						{ text: 'Options', link: '/mock/options' },
						{ text: 'Decorators', link: '/mock/decorators' },
						{ text: 'Manual Usage', link: '/mock/manual' },
						{ text: 'Recording & Replay', link: '/mock/recording' },
						{ text: 'Changelog', link: '/mock/changelog' },
					],
				},
			],
			'/mcp/': [
				{
					text: 'MCP',
					items: [
						{ text: 'Overview', link: '/mcp/' },
						{ text: 'Advanced setup', link: '/mcp/advanced-setup' },
						{ text: 'Options', link: '/mcp/options' },
						{ text: 'Manual Usage', link: '/mcp/manual' },
						{ text: 'Changelog', link: '/mcp/changelog' },
					],
				},
			],
		},
		outline: [2, 6],
		search: { provider: 'local' },
		footer: {
			message: 'Released under the MIT License.',
			copyright: 'Copyright © 2025-present @nest-openapi',
		},
	},
});
