export default {
  '*.{ts,js,mjs,html}': ['cspell', 'eslint --fix', 'prettier --write'],
  '*.{json,css,md}': ['prettier --write'],
};
