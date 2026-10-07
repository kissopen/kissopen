import { readFile } from 'node:fs/promises';

// A development safeguard, not a substitute for reviewing the host changes.
const extraction = JSON.parse(await readFile(new URL('../EXTRACTION.json', import.meta.url), 'utf8'));
if (extraction.desktopHostIdentityIsolated !== true) {
    console.error('Desktop host isolation is not complete. Do not launch this candidate against the commercial Agent or user-data directory. Complete the separately confirmed host changes first.');
    process.exitCode = 1;
}
