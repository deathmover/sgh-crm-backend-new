#!/usr/bin/env node
// Prints the café key for a café id, without calling the server.
//   SIGNING_SECRET=... node tools/cafe-key.mjs shaukeens-hub
import { cafeKeyFor } from '../src/worker.js';

const cafeId = process.argv[2];
const secret = process.env.SIGNING_SECRET;
if (!secret || !/^[a-z0-9][a-z0-9-]{2,39}$/.test(cafeId || '')) {
  console.error('Usage: SIGNING_SECRET=<secret> node tools/cafe-key.mjs <cafe-id>   (3–40 lowercase letters, digits, dashes)');
  process.exit(1);
}
console.log(await cafeKeyFor(cafeId, secret));
