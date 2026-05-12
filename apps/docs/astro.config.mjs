// @ts-check

import node from "@astrojs/node";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightThemeRapide from "starlight-theme-rapide";

// https://astro.build/config
export default defineConfig({
	site: "https://lexshift.lou.gg",
	integrations: [
		starlight({
			title: "Lexshift",
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/louisescher/lexshift",
				},
			],
			sidebar: [
				{
					label: "Guides",
					items: [{ label: "Getting started", slug: "guides/example" }],
				},
				{
					label: "Reference",
					items: [{ autogenerate: { directory: "reference" } }],
				},
			],
			plugins: [starlightThemeRapide()],
		}),
	],

	adapter: node({
		mode: "standalone",
	}),
});
