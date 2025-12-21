import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.jquery,
                ...globals.node,
                ...globals.worker,
                __APP_VERSION__: 'readonly',
            },
            ecmaVersion: 'latest',
            sourceType: 'module',
        },
        rules: {
            'no-var': 'off',
            'max-len': 'off',
            'camelcase': 'off',
            'new-cap': 'off',
            'no-extend-native': ['error', { exceptions: ['Array'] }],
            'indent': 'off',
            'quotes': 'off',
            'semi': 'off',
            'no-unused-vars': 'warn',
            'no-undef': 'warn',
            'no-redeclare': 'off',
            'no-constant-condition': 'off',
            'no-inner-declarations': 'off',
            'no-control-regex': 'off',
            'no-extra-semi': 'off',
        },
    },
    {
        ignores: ['dist/**', 'node_modules/**', 'Rakefile'],
    },
];
