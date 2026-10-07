import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Node supplies the platform here, so the same tests that guard the
        // phone's reduction and encryption also prove the desktop primitives
        // produce the same bytes.
        setupFiles: ['./sources/testing/installNodePlatform.ts'],
        include: ['sources/**/*.{test,spec}.ts'],
    },
});
