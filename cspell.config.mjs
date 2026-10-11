import { defineConfig } from 'cspell';

export default defineConfig({
  version: '0.2',
  dictionaryDefinitions: [
    {
      name: 'project-words',
      path: './.cspell/project-words.txt',
      addWords: true,
    },
  ],
  dictionaries: ['project-words'],
  ignorePaths: [
    'node_modules',
    'dist',
    'coverage',
    '.git',
    '.vscode',
    '.idea',
    '*.spec.ts',
    'firebase.config.json',
    'ngsw-config.json',
    'firebase.config',
    'skills-lock.json',
    'DESIGN.md',
  ],
});
