const useJunit = process.env.JUNIT === '1';

module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['<rootDir>/tests/**/*.test.ts'],
    reporters: [
        'default',
        ...(useJunit
            ? [
                ['jest-junit', {
                    outputDirectory: 'junit-reports',
                    outputName: 'report.xml'
                }]
            ]
            : []
        )
    ]
};