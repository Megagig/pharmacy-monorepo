module.exports = {
    extends: [
        './base.js',
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
        'plugin:jsx-a11y/recommended',
    ],
    plugins: ['react', 'react-hooks', 'jsx-a11y'],
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
    },
    rules: {
        // React
        'react/react-in-jsx-scope': 'off', // Not needed in React 18+
        'react/prop-types': 'off', // Using TypeScript
        'react/jsx-uses-react': 'off',
        'react/jsx-uses-vars': 'warn',
        'react/jsx-key': 'error',
        'react/no-unescaped-entities': 'warn',

        // React Hooks
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',

        // Accessibility
        'jsx-a11y/anchor-is-valid': 'warn',
        'jsx-a11y/click-events-have-key-events': 'warn',
        'jsx-a11y/no-static-element-interactions': 'warn',
    },
    settings: {
        react: {
            version: 'detect',
        },
    },
};
