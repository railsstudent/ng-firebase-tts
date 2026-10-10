export function formatAcceptedFormats(types: readonly string[], locale = 'en'): string {
  if (types.length === 0) {
    return '';
  }
  const formats = Array.from(
    new Set(
      types.map((type) => {
        const ext = type.replace('image/', '').toLowerCase();
        return (ext === 'jpg' ? 'jpeg' : ext).toUpperCase();
      }),
    ),
  );
  return new Intl.ListFormat(locale, { style: 'long', type: 'disjunction' }).format(formats);
}
