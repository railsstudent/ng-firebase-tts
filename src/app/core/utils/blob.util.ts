function isValidBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'blob:';
  } catch (e) {
    console.error(e);
    return false;
  }
}

/**
 * Safely revokes a browser Object URL (blob: protocol) to release memory.
 * Gracefully ignores undefined, null, or invalid URLs.
 */
export function revokeBlobURL(blobUrl: string | undefined): void {
  if (blobUrl && isValidBlobUrl(blobUrl)) {
    URL.revokeObjectURL(blobUrl);
  }
}
