import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default defineConfig({
  files: ['src/**/*.ts', 'scripts/**/*.ts', 'prisma.config.ts'],
  extends: [js.configs.recommended, tseslint.configs.recommended, prettier],
});
