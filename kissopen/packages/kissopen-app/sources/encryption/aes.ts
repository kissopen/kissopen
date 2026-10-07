// Moved to @kissopen/kissopen-sync, which the desktop client shares.
// Kept here as a forwarding module so the app's existing imports still
// resolve; import the package directly in new code.
// The platform implementation underneath is platformAes.ts / its Metro pair.
export * from '@kissopen/kissopen-sync/crypto/aes';
