// GitHub Pages base handling:
// - If deploying under user/organization site (nest-openapi.github.io), base should be "/".
// - If deploying under a project site (nest-openapi.github.io/<repo>), base should be "/<repo>/".
// Auto-detect using GITHUB_REPOSITORY when building in CI, override via DOCS_BASE if needed.
declare const process: any;
const repo = process?.env?.GITHUB_REPOSITORY?.split("/")[1];
const isOrgSite = repo?.endsWith(".github.io");
const computedBase = isOrgSite ? "/" : repo ? `/${repo}/` : "/";
const base = (process?.env?.DOCS_BASE as string) || computedBase;

export default {
	title: "@nest-openapi",
	description: "Modern, modular OpenAPI utilities for NestJS",
	base,
	head: [
		["meta", { name: "theme-color", content: "#111827" }],
		["link", { rel: "icon", href: `${base}favicon.png` }],
	],
	themeConfig: {
		logo: { src: `${base}nest-openapi-logo.png`, alt: "nest-openapi" },
		nav: [
			{ text: "Home", link: "/" },
			{ text: "Validator", link: "/validator/" },
			{ text: "Serializer", link: "/serializer/" },
			{ text: "Mock", link: "/mock/" },
		],
		socialLinks: [
			{ icon: "github", link: "https://github.com/ts-oas/nest-openapi" },
		],
		sidebar: {
			"/validator/": [
				{
					text: "Validator",
					items: [
						{ text: "Overview", link: "/validator/" },
						{ text: "Advanced setup", link: "/validator/advanced-setup" },
						{ text: "Options", link: "/validator/options" },
						{ text: "Decorators", link: "/validator/decorators" },
						{ text: "Manual Validation", link: "/validator/manual" },
					],
				},
			],
			"/serializer/": [
				{
					text: "Serializer",
					items: [
						{ text: "Overview", link: "/serializer/" },
						{ text: "Options", link: "/serializer/options" },
						{ text: "Decorators", link: "/serializer/decorators" },
						{ text: "Manual Serialization", link: "/serializer/manual" },
					],
				},
			],
			"/mock/": [
				{
					text: "Mock",
					items: [
						{ text: "Overview", link: "/mock/" },
						{ text: "Options", link: "/mock/options" },
						{ text: "Decorators", link: "/mock/decorators" },
						{ text: "Manual Usage", link: "/mock/manual" },
						{ text: "Recording & Replay", link: "/mock/recording" },
					],
				},
			],
		},
		outline: [2, 6],
		search: { provider: "local" },
		footer: {
			message: "Released under the MIT License.",
			copyright: "Copyright © 2025-present @nest-openapi",
		},
	},
};
