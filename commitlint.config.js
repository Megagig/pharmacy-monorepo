module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [
            2,
            'always',
            [
                'feat',     // New feature
                'fix',      // Bug fix
                'docs',     // Documentation changes
                'style',    // Code style changes (formatting, etc.)
                'refactor', // Code refactoring
                'perf',     // Performance improvements
                'test',     // Adding or updating tests
                'build',    // Build system or dependencies
                'ci',       // CI/CD changes
                'chore',    // Other changes (maintenance, etc.)
                'revert',   // Revert a previous commit
            ],
        ],
        'scope-enum': [
            2,
            'always',
            [
                'web',
                'mobile',
                'desktop',
                'api',
                'types',
                'api-client',
                'hooks',
                'utils',
                'store',
                'constants',
                'ui',
                'config',
                'deps',
                'monorepo',
            ],
        ],
        'subject-case': [2, 'always', 'sentence-case'],
    },
};
