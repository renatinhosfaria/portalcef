/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageUploader } from '../components/ImageUploader';

vi.mock('next/image', () => ({
    default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

describe('ImageUploader', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('envia upload pelo namespace basePath do loja-admin', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                data: {
                    url: '/uploads/camiseta.png',
                    key: 'camiseta.png',
                    name: 'camiseta.png',
                },
            }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const onChange = vi.fn();
        const { container } = render(
            <ImageUploader value={[]} onChange={onChange} maxFiles={5} />,
        );

        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['conteudo'], 'camiseta.png', { type: 'image/png' });

        fireEvent.change(input, {
            target: {
                files: [file],
            },
        });

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                '/loja-admin/api/storage/upload',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.any(FormData),
                }),
            );
        });
        expect(onChange).toHaveBeenCalledWith(['/uploads/camiseta.png']);
    });

    it('exibe a mensagem real retornada pela API quando o upload falha', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({
                success: false,
                error: {
                    success: false,
                    error: {
                        code: 'INVALID_FILE_TYPE',
                        message: 'Tipo de arquivo não permitido',
                    },
                },
            }),
        });
        vi.stubGlobal('fetch', fetchMock);

        const { container } = render(
            <ImageUploader value={[]} onChange={vi.fn()} maxFiles={5} />,
        );

        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['conteudo'], 'ChatGPT Image.png', { type: 'image/png' });

        fireEvent.change(input, {
            target: {
                files: [file],
            },
        });

        await waitFor(() => {
            expect(screen.getByText('Tipo de arquivo não permitido')).toBeTruthy();
        });
    });
});
