import zlib from 'node:zlib';

// Let's test compressing a sample JSON payload and then running our decompressor logic
const sampleJson = JSON.stringify({
  success: true,
  data: {
    vehicle_number: "DL10CE1234",
    owner_name: "ARJUN KUMAR",
    status: "Active"
  }
});

// Compress with gzip
const gzipped = zlib.gzipSync(Buffer.from(sampleJson));

console.log('--- If we read gzipped buffer as utf-8 directly (what caused the bug): ---');
console.log(gzipped.toString('utf-8').slice(0, 80));

console.log('\n--- With our zlib decompression logic: ---');
function decompressIfNeeded(buffer: Buffer, encoding?: string): string {
  const enc = (encoding || '').toLowerCase();
  try {
    if (enc.includes('gzip') || (buffer[0] === 0x1f && buffer[1] === 0x8b)) {
      return zlib.gunzipSync(buffer).toString('utf-8');
    }
    if (enc.includes('deflate') || (buffer[0] === 0x78 && (buffer[1] === 0x9c || buffer[1] === 0x01 || buffer[1] === 0xda))) {
      return zlib.inflateSync(buffer).toString('utf-8');
    }
    if (enc.includes('br')) {
      return zlib.brotliDecompressSync(buffer).toString('utf-8');
    }
  } catch (err: any) {
    console.warn('Decompression fallback:', err.message);
  }
  return buffer.toString('utf-8');
}

const decompressed = decompressIfNeeded(gzipped, 'gzip');
console.log('Decompressed successfully:');
console.log(decompressed);

// Test magic bytes detection when header is missing or stripped
const magicByteDecompressed = decompressIfNeeded(gzipped, undefined);
console.log('\nMagic byte auto-detection (even if header missing):');
console.log(magicByteDecompressed);
