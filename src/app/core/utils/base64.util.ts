export function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i = i + 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function isBlobPart(value: unknown): value is BlobPart {
  return (
    typeof value === 'string' ||
    value instanceof Blob ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value)
  );
}

export function decodeBase64AsBlobPart(base64: string): BlobPart {
  const rawBytes = decodeBase64(base64);
  if (isBlobPart(rawBytes)) {
    return rawBytes;
  }
  throw new Error('Decoded bytes are not a valid BlobPart.');
}
