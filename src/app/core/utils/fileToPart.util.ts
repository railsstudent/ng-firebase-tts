const MIN_SPLIT_PARTS = 2;
const DATA_PART_INDEX = 1;

function getDataPart(fileReaderResult: string) {
  const splittedResults = fileReaderResult.split(',');
  if (splittedResults.length >= MIN_SPLIT_PARTS) {
    return splittedResults[DATA_PART_INDEX];
  }
  throw new Error('FileReader result is not in expected format');
}

function handleReaderLoadEnd(
  reader: FileReader,
  resolve: (value: string) => void,
  reject: (reason: unknown) => void,
): void {
  if (reader.result === null) {
    return reject(new Error('FileReader returned null result'));
  }

  const fileReaderResult = reader.result;
  try {
    if (typeof fileReaderResult === 'string') {
      return resolve(getDataPart(fileReaderResult));
    } else {
      const decoder = new TextDecoder('utf-8'); // Specify encoding if needed
      const text = decoder.decode(fileReaderResult);
      return resolve(getDataPart(text));
    }
  } catch (error) {
    console.error(error);
    return reject(error);
  }
}

export async function fileToGenerativePart(file: File) {
  const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => handleReaderLoadEnd(reader, resolve, reject);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
}
