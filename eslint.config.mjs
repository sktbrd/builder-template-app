import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import prettier from 'eslint-plugin-prettier'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import unusedImports from 'eslint-plugin-unused-imports'

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'node_modules/**',
    'dist/**',
    // Agent-isolation worktrees keep a multi-GB full clone of the repo,
    // including their own `.next/` cache. Without this, `eslint --fix .`
    // spends 30+ minutes trying to lint the SSR bundle dumps.
    '.claude/worktrees/**',
  ]),
  {
    plugins: {
      'unused-imports': unusedImports,
      'simple-import-sort': simpleImportSort,
      prettier: prettier,
    },
    rules: {
      // Import/unused imports rules (fixable)
      'unused-imports/no-unused-imports': 'error',

      // Import sorting rules (fixable)
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      // Console rules
      'no-console': [
        'warn',
        {
          allow: ['error', 'warn', 'info'],
        },
      ],

      // Prettier rules (fixable)
      'prettier/prettier': ['error', {}, { usePrettierrc: true }],
    },
  },
])

export default eslintConfig
