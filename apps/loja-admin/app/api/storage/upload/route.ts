import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const cookieHeader = cookieStore.toString();

        // Get the form data from the request
        const formData = await request.formData();

        // Forward the request to the backend
        const response = await fetch(`${API_URL}/storage/upload`, {
            method: 'POST',
            headers: {
                'Cookie': cookieHeader,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return NextResponse.json(
                { success: false, error: errorData },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Storage upload proxy error:', error);
        return NextResponse.json(
            { success: false, error: { message: 'Erro ao fazer upload do arquivo' } },
            { status: 500 }
        );
    }
}
