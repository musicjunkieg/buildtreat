import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		// Dev-only: lets the Cloudflare quick tunnel reach the dev server for
		// remote preview and screenshot rounds.
		allowedHosts: ['.trycloudflare.com']
	}
});
