import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import unicorn from 'eslint-plugin-unicorn';

export default defineConfig([
  {
    files: ['**/*.ts'],
    plugins: {
      unicorn,
    },
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      'max-lines-per-function': [
        'error',
        {
          max: 40,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'prefer-const': [
        'error',
        {
          destructuring: 'any',
          ignoreReadBeforeAssign: false,
        },
      ],
      curly: ['error', 'all'],
      'no-plusplus': ['error'],
      'arrow-body-style': ['error', 'as-needed'],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/../*', '**/./../*'],
              message:
                'Parent relative imports (..) are forbidden. Use sibling relative imports (./) for files in the same directory or absolute aliases (@/) for cross-directory imports.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MethodDefinition[key.type="PrivateIdentifier"]',
          message: 'Use TypeScript private keyword instead of # prefix for class methods.',
        },
      ],
      complexity: ['error', { max: 10 }],
      'unicorn/prefer-switch': ['error', { minimumCases: 4 }],
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        {
          accessibility: 'no-public', // Default accessibility for class members is 'public'
          overrides: {
            properties: 'off', // Keep 'off' so native '#' private fields do not throw errors
            parameterProperties: 'off',
          },
        },
      ],
      'max-params': 'off',
      '@typescript-eslint/max-params': ['error', { max: 3 }],
      'max-lines': ['error', { max: 300, skipComments: true, skipBlankLines: true }],
      'no-magic-numbers': 'off',
      '@typescript-eslint/no-magic-numbers': ['error', { ignoreArrayIndexes: true, ignore: [0, 1, 2] }],
      '@typescript-eslint/no-floating-promises': ['error'],
      '@typescript-eslint/no-non-null-assertion': ['error'],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true, // Allows arrow functions and expressions (e.g. inline callbacks) to omit return types
          allowTypedFunctionExpressions: true, // Allows functions whose type is already defined by context
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
        },
      ],
    },
  },
  {
    files: ['src/app/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/../*', '**/./../*'],
              message:
                'Parent relative imports (..) are forbidden. Use sibling relative imports (./) for files in the same directory or absolute aliases (@/) for cross-directory imports.',
            },
            {
              group: ['@/features/**', '**/features/**'],
              message: 'Layer violation: Shared layer cannot import from Feature layer.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/../*', '**/./../*'],
              message:
                'Parent relative imports (..) are forbidden. Use sibling relative imports (./) for files in the same directory or absolute aliases (@/) for cross-directory imports.',
            },
            {
              group: ['@/features/**', '@/shared/**', '**/features/**', '**/shared/**'],
              message: 'Layer violation: Core layer cannot import from Feature or Shared layers.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.spec.ts', 'src/testing/*'],
    rules: {
      'max-lines-per-function': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      'max-lines': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
