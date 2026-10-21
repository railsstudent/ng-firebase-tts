export default {
  '*.{ts,js,mjs,html}': ['cspell --no-must-find-files', 'eslint --fix', 'prettier --write'],
  '*.{json,css,md}': ['cspell --no-must-find-files', 'prettier --write'],
};
