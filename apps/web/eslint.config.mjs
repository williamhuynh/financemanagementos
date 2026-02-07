import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', '../../.next/**', 'dist/**'],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs}'],
    extends: [
      ...tseslint.configs.recommended,
    ],
    rules: {
      // Relax some strict rules for this project
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        caughtErrors: 'none', // Allow unused catch parameters
      }],
      '@typescript-eslint/no-explicit-any': 'off', // Too many to fix right now
      '@typescript-eslint/no-unsafe-function-type': 'off', // Allow Function type for now
      'no-console': 'off',
    },
  }
);
