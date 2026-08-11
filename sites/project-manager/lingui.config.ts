import { defineConfig } from '@lingui/conf';

export default defineConfig({
  sourceLocale: 'nl',
  locales: ['nl', 'en'],
  compileNamespace: 'es',
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['src'],
    },
  ],
});
