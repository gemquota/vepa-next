import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const source = resolve(root, 'docs/systems');
const destination = resolve(root, 'dist/docs/systems');

await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
console.log(`Published systems atlas to ${destination}`);
