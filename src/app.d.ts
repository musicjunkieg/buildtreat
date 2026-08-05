// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { OAuthSession } from '@atcute/oauth-node-client';
import type { Client } from '@atcute/client';
import type { Did } from '@atcute/lexicons';
import type { CfProperties, D1Database, ExecutionContext, KVNamespace } from '@cloudflare/workers-types';

declare global {
	namespace App {
		interface Locals {
			session: OAuthSession | null;
			client: Client | null;
			did: Did | null;
		}
		interface Platform {
			env: {
				OAUTH_SESSIONS: KVNamespace;
				OAUTH_STATES: KVNamespace;
				PROFILE_CACHE: KVNamespace;
				DB: D1Database;
			};
			cf: CfProperties;
			ctx: ExecutionContext;
		}
	}
}

export {};
