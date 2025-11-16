import * as fs from 'fs';
import * as path from 'path';
import { PersistenceManager } from './PersistenceManager';
import { EventAggregator } from './EventAggregator';

export interface TestInfo {
    framework: 'jest' | 'mocha' | 'vitest' | 'cypress' | 'playwright';
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    coverage?: {
        lines: number;
        functions: number;
        branches: number;
        statements: number;
    };
    duration: number;
    timestamp: string;
}

export class TestCaptureEngine {
    private lastTestHashes: Map<string, string> = new Map();
    private watchers: NodeJS.Timeout[] = [];

    constructor(
        private workspaceRoot: string,
        private persistence: PersistenceManager,
        private eventAggregator: EventAggregator
    ) {
        this.persistence.logWithEmoji('🧪', 'TestCaptureEngine initialized');
    }

    public start(): void {
        this.startJestWatcher();
        this.startMochaWatcher();
        this.startVitestWatcher();
        this.startCypressWatcher();
        this.startPlaywrightWatcher();
        
        // Capture initial
        this.captureAllTests();
        
        this.persistence.logWithEmoji('🚀', 'TestCaptureEngine started');
    }

    // ✅ Priorité 3: Jest test reports
    private startJestWatcher(): void {
        const jestFiles = this.findFiles([
            'jest.config.js', 'jest.config.ts', 'jest.config.json',
            'coverage/lcov-report/index.html', 'coverage/coverage-summary.json',
            'test-results.json', 'jest-results.json'
        ]);
        
        jestFiles.forEach(file => {
            const watcher = setInterval(() => {
                try {
                    const content = fs.readFileSync(file, 'utf-8');
                    const hash = this.generateHash(content);
                    
                    if (hash !== this.lastTestHashes.get(file)) {
                        this.captureJestTests(file);
                        this.lastTestHashes.set(file, hash);
                    }
                } catch (error) {
                    this.persistence.logWithEmoji('❌', `Failed to watch Jest ${file}: ${error}`);
                }
            }, 10000); // Check every 10 seconds (tests run less frequently)

            this.watchers.push(watcher);
        });

        if (jestFiles.length > 0) {
            this.persistence.logWithEmoji('🧪', `Jest watcher started for ${jestFiles.length} files`);
        }
    }

    private startMochaWatcher(): void {
        const mochaFiles = this.findFiles([
            '.mocharc.json', '.mocharc.js', 'mocha.opts',
            'test-results.xml', 'mocha-results.json'
        ]);
        
        mochaFiles.forEach(file => {
            const watcher = setInterval(() => {
                try {
                    const content = fs.readFileSync(file, 'utf-8');
                    const hash = this.generateHash(content);
                    
                    if (hash !== this.lastTestHashes.get(file)) {
                        this.captureMochaTests(file);
                        this.lastTestHashes.set(file, hash);
                    }
                } catch (error) {
                    this.persistence.logWithEmoji('❌', `Failed to watch Mocha ${file}: ${error}`);
                }
            }, 10000);

            this.watchers.push(watcher);
        });

        if (mochaFiles.length > 0) {
            this.persistence.logWithEmoji('🧪', `Mocha watcher started for ${mochaFiles.length} files`);
        }
    }

    private startVitestWatcher(): void {
        const vitestFiles = this.findFiles([
            'vitest.config.ts', 'vitest.config.js', 'vitest.config.json',
            'coverage/lcov-report/index.html', 'vitest-results.json'
        ]);
        
        vitestFiles.forEach(file => {
            const watcher = setInterval(() => {
                try {
                    const content = fs.readFileSync(file, 'utf-8');
                    const hash = this.generateHash(content);
                    
                    if (hash !== this.lastTestHashes.get(file)) {
                        this.captureVitestTests(file);
                        this.lastTestHashes.set(file, hash);
                    }
                } catch (error) {
                    this.persistence.logWithEmoji('❌', `Failed to watch Vitest ${file}: ${error}`);
                }
            }, 10000);

            this.watchers.push(watcher);
        });

        if (vitestFiles.length > 0) {
            this.persistence.logWithEmoji('🧪', `Vitest watcher started for ${vitestFiles.length} files`);
        }
    }

    private startCypressWatcher(): void {
        const cypressFiles = this.findFiles([
            'cypress.config.js', 'cypress.config.ts',
            'cypress/reports/mochawesome.json', 'cypress/screenshots',
            'cypress/videos'
        ]);
        
        cypressFiles.forEach(file => {
            const watcher = setInterval(() => {
                try {
                    const content = fs.readFileSync(file, 'utf-8');
                    const hash = this.generateHash(content);
                    
                    if (hash !== this.lastTestHashes.get(file)) {
                        this.captureCypressTests(file);
                        this.lastTestHashes.set(file, hash);
                    }
                } catch (error) {
                    this.persistence.logWithEmoji('❌', `Failed to watch Cypress ${file}: ${error}`);
                }
            }, 10000);

            this.watchers.push(watcher);
        });

        if (cypressFiles.length > 0) {
            this.persistence.logWithEmoji('🧪', `Cypress watcher started for ${cypressFiles.length} files`);
        }
    }

    private startPlaywrightWatcher(): void {
        const playwrightFiles = this.findFiles([
            'playwright.config.ts', 'playwright.config.js',
            'test-results.json', 'playwright-report'
        ]);
        
        playwrightFiles.forEach(file => {
            const watcher = setInterval(() => {
                try {
                    const content = fs.readFileSync(file, 'utf-8');
                    const hash = this.generateHash(content);
                    
                    if (hash !== this.lastTestHashes.get(file)) {
                        this.capturePlaywrightTests(file);
                        this.lastTestHashes.set(file, hash);
                    }
                } catch (error) {
                    this.persistence.logWithEmoji('❌', `Failed to watch Playwright ${file}: ${error}`);
                }
            }, 10000);

            this.watchers.push(watcher);
        });

        if (playwrightFiles.length > 0) {
            this.persistence.logWithEmoji('🧪', `Playwright watcher started for ${playwrightFiles.length} files`);
        }
    }

    private captureJestTests(filePath: string): void {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            let testInfo: TestInfo;
            
            if (filePath.includes('coverage-summary.json')) {
                testInfo = this.parseJestCoverage(content);
            } else if (filePath.includes('test-results.json') || filePath.includes('jest-results.json')) {
                testInfo = this.parseJestResults(content);
            } else {
                // Jest config file
                testInfo = this.parseJestConfig(content);
            }

            this.eventAggregator.captureEvent(
                'file_change',
                filePath,
                {
                    type: 'test',
                    test: testInfo,
                    level: '1 - Code & Structure Technique',
                    category: 'Test Reports',
                    framework: 'jest'
                }
            );

            this.persistence.logWithEmoji('🧪', `Captured Jest tests: ${testInfo.totalTests} total, ${testInfo.passed} passed, ${testInfo.failed} failed`);

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to parse Jest ${filePath}: ${error}`);
        }
    }

    private captureMochaTests(filePath: string): void {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            let testInfo: TestInfo;
            
            if (filePath.includes('test-results.xml')) {
                testInfo = this.parseMochaXML(content);
            } else if (filePath.includes('mocha-results.json')) {
                testInfo = this.parseMochaJSON(content);
            } else {
                // Mocha config file
                testInfo = this.parseMochaConfig(content);
            }

            this.eventAggregator.captureEvent(
                'file_change',
                filePath,
                {
                    type: 'test',
                    test: testInfo,
                    level: '1 - Code & Structure Technique',
                    category: 'Test Reports',
                    framework: 'mocha'
                }
            );

            this.persistence.logWithEmoji('🧪', `Captured Mocha tests: ${testInfo.totalTests} total, ${testInfo.passed} passed, ${testInfo.failed} failed`);

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to parse Mocha ${filePath}: ${error}`);
        }
    }

    private captureVitestTests(filePath: string): void {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            let testInfo: TestInfo;
            
            if (filePath.includes('vitest-results.json')) {
                testInfo = this.parseVitestResults(content);
            } else {
                // Vitest config file
                testInfo = this.parseVitestConfig(content);
            }

            this.eventAggregator.captureEvent(
                'file_change',
                filePath,
                {
                    type: 'test',
                    test: testInfo,
                    level: '1 - Code & Structure Technique',
                    category: 'Test Reports',
                    framework: 'vitest'
                }
            );

            this.persistence.logWithEmoji('🧪', `Captured Vitest tests: ${testInfo.totalTests} total, ${testInfo.passed} passed, ${testInfo.failed} failed`);

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to parse Vitest ${filePath}: ${error}`);
        }
    }

    private captureCypressTests(filePath: string): void {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            let testInfo: TestInfo;
            
            if (filePath.includes('mochawesome.json')) {
                testInfo = this.parseCypressMochawesome(content);
            } else {
                // Cypress config file
                testInfo = this.parseCypressConfig(content);
            }

            this.eventAggregator.captureEvent(
                'file_change',
                filePath,
                {
                    type: 'test',
                    test: testInfo,
                    level: '1 - Code & Structure Technique',
                    category: 'Test Reports',
                    framework: 'cypress'
                }
            );

            this.persistence.logWithEmoji('🧪', `Captured Cypress tests: ${testInfo.totalTests} total, ${testInfo.passed} passed, ${testInfo.failed} failed`);

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to parse Cypress ${filePath}: ${error}`);
        }
    }

    private capturePlaywrightTests(filePath: string): void {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            let testInfo: TestInfo;
            
            if (filePath.includes('test-results.json')) {
                testInfo = this.parsePlaywrightResults(content);
            } else {
                // Playwright config file
                testInfo = this.parsePlaywrightConfig(content);
            }

            this.eventAggregator.captureEvent(
                'file_change',
                filePath,
                {
                    type: 'test',
                    test: testInfo,
                    level: '1 - Code & Structure Technique',
                    category: 'Test Reports',
                    framework: 'playwright'
                }
            );

            this.persistence.logWithEmoji('🧪', `Captured Playwright tests: ${testInfo.totalTests} total, ${testInfo.passed} passed, ${testInfo.failed} failed`);

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to parse Playwright ${filePath}: ${error}`);
        }
    }

    // Parsing methods for different test frameworks
    private parseJestCoverage(content: string): TestInfo {
        const coverage = JSON.parse(content);
        return {
            framework: 'jest',
            totalTests: 0, // Coverage doesn't include test counts
            passed: 0,
            failed: 0,
            skipped: 0,
            coverage: {
                lines: coverage.total?.lines?.pct || 0,
                functions: coverage.total?.functions?.pct || 0,
                branches: coverage.total?.branches?.pct || 0,
                statements: coverage.total?.statements?.pct || 0
            },
            duration: 0,
            timestamp: new Date().toISOString()
        };
    }

    private parseJestResults(content: string): TestInfo {
        const results = JSON.parse(content);
        return {
            framework: 'jest',
            totalTests: results.numTotalTests || 0,
            passed: results.numPassedTests || 0,
            failed: results.numFailedTests || 0,
            skipped: results.numPendingTests || 0,
            duration: results.startTime ? Date.now() - results.startTime : 0,
            timestamp: new Date().toISOString()
        };
    }

    private parseJestConfig(content: string): TestInfo {
        // Jest config doesn't contain test results, just configuration
        return {
            framework: 'jest',
            totalTests: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
            timestamp: new Date().toISOString()
        };
    }

    private parseMochaXML(content: string): TestInfo {
        // Basic XML parsing for Mocha results
        const totalMatch = content.match(/tests="(\d+)"/);
        const failuresMatch = content.match(/failures="(\d+)"/);
        const skippedMatch = content.match(/skipped="(\d+)"/);
        
        const total = totalMatch ? parseInt(totalMatch[1]) : 0;
        const failed = failuresMatch ? parseInt(failuresMatch[1]) : 0;
        const skipped = skippedMatch ? parseInt(skippedMatch[1]) : 0;
        const passed = total - failed - skipped;

        return {
            framework: 'mocha',
            totalTests: total,
            passed,
            failed,
            skipped,
            duration: 0,
            timestamp: new Date().toISOString()
        };
    }

    private parseMochaJSON(content: string): TestInfo {
        const results = JSON.parse(content);
        return {
            framework: 'mocha',
            totalTests: results.stats?.tests || 0,
            passed: results.stats?.passes || 0,
            failed: results.stats?.failures || 0,
            skipped: results.stats?.pending || 0,
            duration: results.stats?.duration || 0,
            timestamp: new Date().toISOString()
        };
    }

    private parseMochaConfig(content: string): TestInfo {
        return {
            framework: 'mocha',
            totalTests: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
            timestamp: new Date().toISOString()
        };
    }

    private parseVitestResults(content: string): TestInfo {
        const results = JSON.parse(content);
        return {
            framework: 'vitest',
            totalTests: results.numTotalTests || 0,
            passed: results.numPassedTests || 0,
            failed: results.numFailedTests || 0,
            skipped: results.numPendingTests || 0,
            duration: results.duration || 0,
            timestamp: new Date().toISOString()
        };
    }

    private parseVitestConfig(content: string): TestInfo {
        return {
            framework: 'vitest',
            totalTests: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
            timestamp: new Date().toISOString()
        };
    }

    private parseCypressMochawesome(content: string): TestInfo {
        const results = JSON.parse(content);
        return {
            framework: 'cypress',
            totalTests: results.stats?.tests || 0,
            passed: results.stats?.passes || 0,
            failed: results.stats?.failures || 0,
            skipped: results.stats?.pending || 0,
            duration: results.stats?.duration || 0,
            timestamp: new Date().toISOString()
        };
    }

    private parseCypressConfig(content: string): TestInfo {
        return {
            framework: 'cypress',
            totalTests: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
            timestamp: new Date().toISOString()
        };
    }

    private parsePlaywrightResults(content: string): TestInfo {
        const results = JSON.parse(content);
        return {
            framework: 'playwright',
            totalTests: results.stats?.total || 0,
            passed: results.stats?.passed || 0,
            failed: results.stats?.failed || 0,
            skipped: results.stats?.skipped || 0,
            duration: results.stats?.duration || 0,
            timestamp: new Date().toISOString()
        };
    }

    private parsePlaywrightConfig(content: string): TestInfo {
        return {
            framework: 'playwright',
            totalTests: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
            timestamp: new Date().toISOString()
        };
    }

    private findFiles(patterns: string[]): string[] {
        const files: string[] = [];
        
        try {
            const entries = fs.readdirSync(this.workspaceRoot, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isFile()) {
                    for (const pattern of patterns) {
                        if (entry.name === pattern || entry.name.match(pattern.replace('*', '.*'))) {
                            files.push(path.join(this.workspaceRoot, entry.name));
                        }
                    }
                } else if (entry.isDirectory()) {
                    // Check subdirectories for test results
                    if (entry.name === 'coverage' || entry.name === 'test-results' || entry.name === 'cypress') {
                        try {
                            const subEntries = fs.readdirSync(path.join(this.workspaceRoot, entry.name), { withFileTypes: true });
                            for (const subEntry of subEntries) {
                                if (subEntry.isFile()) {
                                    for (const pattern of patterns) {
                                        if (subEntry.name === pattern || subEntry.name.match(pattern.replace('*', '.*'))) {
                                            files.push(path.join(this.workspaceRoot, entry.name, subEntry.name));
                                        }
                                    }
                                }
                            }
                        } catch (error) {
                            // Ignore subdirectory errors
                        }
                    }
                }
            }
        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to scan directory: ${error}`);
        }
        
        return files;
    }

    private captureAllTests(): void {
        // Capture all existing test files
        const jestFiles = this.findFiles([
            'jest.config.js', 'jest.config.ts', 'jest.config.json',
            'coverage/lcov-report/index.html', 'coverage/coverage-summary.json',
            'test-results.json', 'jest-results.json'
        ]);
        jestFiles.forEach(file => this.captureJestTests(file));

        const mochaFiles = this.findFiles([
            '.mocharc.json', '.mocharc.js', 'mocha.opts',
            'test-results.xml', 'mocha-results.json'
        ]);
        mochaFiles.forEach(file => this.captureMochaTests(file));

        const vitestFiles = this.findFiles([
            'vitest.config.ts', 'vitest.config.js', 'vitest.config.json',
            'coverage/lcov-report/index.html', 'vitest-results.json'
        ]);
        vitestFiles.forEach(file => this.captureVitestTests(file));

        const cypressFiles = this.findFiles([
            'cypress.config.js', 'cypress.config.ts',
            'cypress/reports/mochawesome.json', 'cypress/screenshots',
            'cypress/videos'
        ]);
        cypressFiles.forEach(file => this.captureCypressTests(file));

        const playwrightFiles = this.findFiles([
            'playwright.config.ts', 'playwright.config.js',
            'test-results.json', 'playwright-report'
        ]);
        playwrightFiles.forEach(file => this.capturePlaywrightTests(file));
    }

    private generateHash(content: string): string {
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    public stop(): void {
        this.watchers.forEach(watcher => clearInterval(watcher));
        this.watchers = [];
        this.persistence.logWithEmoji('🛑', 'TestCaptureEngine stopped');
    }
}
