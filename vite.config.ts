import { sveltekit } from '@sveltejs/kit/vite';
import { defaultExternalConditions, defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		// Only this checkout's tests. Without this, vitest also sweeps the
		// eval worktrees under .worktrees/ and fails on their stale imports.
		include: ['src/**/*.{test,spec}.ts']
	},
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
			conditions: ['workerd', 'worker', ...defaultServerConditions],
			externalConditions: ['workerd', 'worker', ...defaultExternalConditions]
		}
	}
});
