/// <reference types="react" />
/// <reference types="react-dom" />

// DOM globals for client components
declare const window: Window & typeof globalThis;
declare const document: Document;
declare function alert(message?: string): void;
declare function confirm(message?: string): boolean;
declare function prompt(message?: string, defaultValue?: string): string | null;
declare const localStorage: Storage;
declare const sessionStorage: Storage;
