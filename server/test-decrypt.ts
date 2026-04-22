/**
 * Local helper: attempt to decrypt subscription fields using current ENCRYPTION_KEY.
 *
 * Usage:
 *   1) File:  tsx server/test-decrypt.ts path/to/sample.json
 *   2) Stdin: type sample.json | tsx server/test-decrypt.ts
 *
 * Notes:
 * - Never commit real production ciphertext/plaintext samples.
 * - This script prints decrypted values to your console.
 */

import fs from 'fs';
import dotenv from 'dotenv';
import { decrypt } from './encryption.service.js';

dotenv.config();

type AnyRecord = Record<string, any>;

const FIELDS_TO_DECRYPT = [
  'serviceName',
  'vendor',
  'paymentMethod',
  'amount',
  'category',
  'currency',
  'description',
  'notes',
] as const;

function readAllStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function safePreview(value: unknown, maxLen = 80): string {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  if (!s) return '';
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

function decryptField(fieldName: string, value: any): any {
  if (value == null) return value;
  // Avoid decrypting objects/arrays; only strings/numbers.
  if (typeof value !== 'string' && typeof value !== 'number') return value;
  return decrypt(value);
}

function decryptKnownFields(obj: AnyRecord): AnyRecord {
  const out: AnyRecord = { ...obj };
  for (const field of FIELDS_TO_DECRYPT) {
    if (out[field] !== undefined) {
      out[field] = decryptField(field, out[field]);
    }
  }
  return out;
}

function printDiff(original: AnyRecord, decryptedObj: AnyRecord): void {
  const id = original.id ?? original._id ?? original.subscriptionId ?? '';
  if (id) console.log(`\nRecord: ${String(id)}`);

  for (const field of FIELDS_TO_DECRYPT) {
    if (original[field] === undefined) continue;

    const before = original[field];
    const after = decryptedObj[field];

    const changed = before !== after;
    const beforePreview = safePreview(before);
    const afterPreview = safePreview(after);

    console.log(`- ${field}: ${changed ? 'decrypted' : 'unchanged'}`);
    console.log(`  before: ${beforePreview}`);
    console.log(`  after : ${afterPreview}`);
  }
}

async function main() {
  const argPath = process.argv.slice(2).find((a) => !a.startsWith('-'));

  let raw = '';
  if (argPath) {
    raw = fs.readFileSync(argPath, 'utf8');
  } else {
    // If there is piped input, read it; otherwise show usage.
    if (process.stdin.isTTY) {
      console.error('Provide a JSON file path or pipe JSON to stdin.');
      console.error('Example: tsx server/test-decrypt.ts .\\sample.json');
      process.exit(2);
    }
    raw = await readAllStdin();
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    console.error('No JSON input provided.');
    process.exit(2);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    console.error('Failed to parse JSON. Make sure you paste valid JSON.');
    process.exit(2);
  }

  // Make failures visible (otherwise decrypt() may silently return ciphertext).
  process.env.LOG_DECRYPT_ERRORS = process.env.LOG_DECRYPT_ERRORS ?? 'true';

  if (Array.isArray(parsed)) {
    console.log(`Loaded ${parsed.length} records.`);
    parsed.slice(0, 10).forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      console.log(`\n=== Item ${idx + 1} ===`);
      const dec = decryptKnownFields(item);
      printDiff(item, dec);
    });
    if (parsed.length > 10) {
      console.log(`\n(Only first 10 shown)`);
    }
  } else if (parsed && typeof parsed === 'object') {
    const dec = decryptKnownFields(parsed);
    printDiff(parsed, dec);

    // Helpful for copy/paste debugging: print a minimal decrypted view
    const minimal: AnyRecord = {
      id: parsed.id ?? parsed._id,
      serviceName: dec.serviceName,
      vendor: dec.vendor,
      paymentMethod: dec.paymentMethod,
      amount: dec.amount,
      category: dec.category,
      currency: dec.currency,
    };

    console.log('\nDecrypted minimal view:');
    console.log(JSON.stringify(minimal, null, 2));
  } else {
    console.error('JSON must be an object or an array of objects.');
    process.exit(2);
  }
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
