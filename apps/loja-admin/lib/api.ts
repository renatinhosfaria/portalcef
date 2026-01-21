/**
 * API Helper para loja-admin
 * 
 * Prefixes all API calls with the Next.js basePath to ensure
 * correct routing in production environments.
 */

const BASE_PATH = '/loja-admin';

/**
 * Returns the full URL for an API endpoint, including the basePath prefix.
 * 
 * @param path - The API path (e.g., '/api/shop/admin/products')
 * @returns The full URL with basePath prefix
 */
export function apiUrl(path: string): string {
    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${BASE_PATH}${normalizedPath}`;
}

/**
 * Wrapper around fetch that automatically adds the basePath to API URLs.
 * 
 * @param path - The API path (e.g., '/api/shop/admin/products')
 * @param init - Fetch init options
 * @returns Fetch response
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    return fetch(apiUrl(path), {
        ...init,
        credentials: 'include', // Ensure cookies are sent (needed for session auth)
    });
}
