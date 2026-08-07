/** Non-auth identity hint so returning visitors get a one-tap sign-in. */
export interface KnownUser {
	handle: string;
	displayName: string | null;
	avatar: string | null;
}
