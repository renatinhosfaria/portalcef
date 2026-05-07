import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
    cookies: vi.fn(async () => ({
        toString: (): string => 'session=sessao-teste',
    })),
}));

describe('proxy de upload de imagens', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.restoreAllMocks();
        process.env.API_INTERNAL_URL = 'http://api:3002';
    });

    it('encaminha upload para a API interna com prefixo /api', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                data: { url: '/uploads/camiseta.png' },
            }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const { POST } = await import('../app/api/storage/upload/route');
        const formData = new FormData();
        formData.append('file', new File(['conteudo'], 'camiseta.png'));

        await POST({
            formData: async () => formData,
        } as never);

        expect(fetchMock).toHaveBeenCalledWith(
            'http://api:3002/api/storage/upload',
            expect.objectContaining({
                method: 'POST',
                headers: { Cookie: 'session=sessao-teste' },
                body: formData,
            }),
        );
    });
});
