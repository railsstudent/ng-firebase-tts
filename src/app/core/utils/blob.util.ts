function isValidBlobUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'blob:';
  } catch (e) {
    console.error(e);
    return false;
  }
}

export function revokeBlobURL(blobUrl: string | undefined) {
  if (blobUrl && isValidBlobUrl(blobUrl)) {
    console.log('Revoking blob URL');
    URL.revokeObjectURL(blobUrl);
  }
}

export function constructBlobURL(parts: BlobPart[]) {
  return URL.createObjectURL(new Blob(parts, { type: 'audio/wav' }));
}
