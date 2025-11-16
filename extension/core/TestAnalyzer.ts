// Test file for CodeAnalyzer

export class TestClass {
    private static instance: TestClass | null = null;
    
    private constructor() {}
    
    public static getInstance(): TestClass {
        if (!TestClass.instance) {
            TestClass.instance = new TestClass();
        }
        return TestClass.instance;
    }
    
    public testFunction(param: string): string {
        return `Test: ${param}`;
    }
    
    public factoryMethod(type: 'a' | 'b'): TestClass {
        return new TestClass();
    }
}

export function createTestInstance() {
    return TestClass.getInstance();
}
// Another test
