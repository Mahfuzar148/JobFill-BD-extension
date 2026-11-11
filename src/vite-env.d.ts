/// <reference types="vite/client" />

/**
 * Compile-time constant injected by `build.js` when creating a clean
 * Microsoft Edge Add-ons Store release bundle (`__JOBFILL_STORE_CLEAN__ = true`).
 * Undefined in Vitest / standard local dev builds so test suites retain fixtures.
 */
declare const __JOBFILL_STORE_CLEAN__: boolean | undefined;

/**
 * Compile-time constant injected by `build.js` when building the initial
 * Microsoft Edge Add-ons Store release bundle (`--edge-store`).
 * Temporarily disables optional Supabase Cloud Sync and Cloud Public Job DB features
 * while preserving Google Chrome compatibility and local-first architecture.
 */
declare const __JOBFILL_CLOUD_SYNC_DISABLED__: boolean | undefined;
