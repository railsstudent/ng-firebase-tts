export default {
  '*.{ts,js,mjs,html}': ['eslint --fix', 'prettier --write'],
  '*.{json,css,md}': ['prettier --write'],
};
