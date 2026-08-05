import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		// Dev-only: lets the Cloudflare quick tunnel reach the dev server for
		// remote preview and screenshot rounds.
		allowedHosts: ['.trycloudflare.com']
	},
	ssr: {
		resolve: {
			// The server bundle runs on workerd, not Node. Without this, Vite
			// resolves conditional exports (e.g. @atcute/multibase's
			// `#bases/base64`) to their node builds, which call internal Buffer
			// methods bare (`base64urlSlice.call(bytes)`) — workerd's stricter
			// polyfill throws `The "start" argument must be of type number`.
			conditions: ['workerd', 'worker'],
			externalConditions: ['workerd', 'worker']
		}
	}
});
