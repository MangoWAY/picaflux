/** @type {import('lint-staged').Configuration} */
export default {
  '*.{ts,tsx,mjs,cjs,js,jsx}': ['eslint --fix --max-warnings 0', 'prettier --write'],
  '*.{json,css,html,md,yml,yaml}': 'prettier --write',
}
