#!/usr/bin/env node
/**
 * Patch script to fix nf3 ESM/CommonJS incompatibility with @vercel/nft
 * 
 * Issue: nf3 tries to use named imports from @vercel/nft (CommonJS)
 * Solution: Convert named import to default import + destructure pattern
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const traceFile = path.join(__dirname, '../node_modules/nf3/dist/_chunks/trace.mjs');

try {
  const content = fs.readFileSync(traceFile, 'utf8');
  
  // Check if already patched
  if (content.includes('const { nodeFileTrace } = nftModule;')) {
    console.log('✓ nf3 already patched');
    process.exit(0);
  }

  // Fix the import statement
  const patched = content.replace(
    /import\s*{\s*nodeFileTrace\s*}\s*from\s*['"]@vercel\/nft['"]/,
    `import nftModule from "@vercel/nft";
const { nodeFileTrace } = nftModule;`
  );

  if (patched === content) {
    console.warn('⚠ nf3 patch pattern not found - already using correct import?');
    process.exit(0);
  }

  fs.writeFileSync(traceFile, patched, 'utf8');
  console.log('✓ nf3 ESM/CommonJS patch applied successfully');
} catch (err) {
  console.error('✗ Failed to patch nf3:', err.message);
  // Don't fail the build - this is a non-critical patch
  process.exit(0);
}
