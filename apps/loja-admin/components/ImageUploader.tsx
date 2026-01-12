'use client';

import { ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useState } from 'react';

interface UploadedImage {
    url: string;
    key: string;
    name: string;
}

interface ImageUploaderProps {
    value: string[];
    onChange: (urls: string[]) => void;
    maxFiles?: number;
}

export function ImageUploader({ value, onChange, maxFiles = 5 }: ImageUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState<{ [key: string]: number }>({});
    const [error, setError] = useState<string | null>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const uploadFile = async (file: File): Promise<UploadedImage | null> => {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/storage/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || 'Erro no upload');
            }

            const result = await response.json();
            if (result.success && result.data) {
                return result.data as UploadedImage;
            }
            throw new Error('Resposta inválida do servidor');
        } catch (err) {
            console.error('Upload error:', err);
            throw err;
        }
    };

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        setError(null);
        const fileArray = Array.from(files);

        // Check max files limit
        if (value.length + fileArray.length > maxFiles) {
            setError(`Máximo de ${maxFiles} imagens permitidas.`);
            return;
        }

        // Validate file types
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        const invalidFiles = fileArray.filter(f => !validTypes.includes(f.type));
        if (invalidFiles.length > 0) {
            setError('Apenas imagens JPG, PNG, WebP e GIF são permitidas.');
            return;
        }

        // Accumulate uploaded URLs
        const uploadedUrls: string[] = [];

        // Upload each file
        for (const file of fileArray) {
            const fileId = `${file.name}-${Date.now()}`;
            setUploading(prev => ({ ...prev, [fileId]: 0 }));

            try {
                // Simulate progress (real progress would require XHR)
                setUploading(prev => ({ ...prev, [fileId]: 50 }));

                const result = await uploadFile(file);

                if (result) {
                    uploadedUrls.push(result.url);
                }

                setUploading(prev => ({ ...prev, [fileId]: 100 }));
                setTimeout(() => {
                    setUploading(prev => {
                        const newState = { ...prev };
                        delete newState[fileId];
                        return newState;
                    });
                }, 500);
            } catch {
                setError(`Erro ao fazer upload de ${file.name}`);
                setUploading(prev => {
                    const newState = { ...prev };
                    delete newState[fileId];
                    return newState;
                });
            }
        }

        // Update state with all uploaded images at once
        if (uploadedUrls.length > 0) {
            onChange([...value, ...uploadedUrls]);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, onChange, maxFiles]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFiles(e.target.files);
        e.target.value = ''; // Reset input
    };

    const removeImage = (urlToRemove: string) => {
        onChange(value.filter(url => url !== urlToRemove));
    };

    const isUploading = Object.keys(uploading).length > 0;

    return (
        <div className="space-y-4">
            {/* Drop Zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                    relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                    ${isDragging
                        ? 'border-[#A3D154] bg-[#A3D154]/10'
                        : 'border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100'
                    }
                `}
            >
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    onChange={handleInputChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isUploading || value.length >= maxFiles}
                />

                <div className="flex flex-col items-center gap-3">
                    {isUploading ? (
                        <>
                            <Loader2 className="w-10 h-10 text-[#A3D154] animate-spin" />
                            <p className="text-sm text-slate-600">Fazendo upload...</p>
                        </>
                    ) : (
                        <>
                            <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center">
                                <ImagePlus className="w-7 h-7 text-slate-500" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-700">
                                    Arraste imagens aqui ou clique para selecionar
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    JPG, PNG, WebP ou GIF • Máximo {maxFiles} imagens
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                    <X className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            {/* Upload Progress */}
            {Object.entries(uploading).map(([fileId, progress]) => (
                <div key={fileId} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <Loader2 className="w-5 h-5 text-[#A3D154] animate-spin shrink-0" />
                    <div className="flex-1">
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[#A3D154] transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                    <span className="text-xs text-slate-500">{progress}%</span>
                </div>
            ))}

            {/* Image Previews */}
            {value.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                    {value.map((url, index) => (
                        <div key={url} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                            <Image
                                src={url}
                                alt={`Imagem ${index + 1}`}
                                fill
                                className="object-cover"
                                unoptimized
                            />
                            <button
                                type="button"
                                onClick={() => removeImage(url)}
                                className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                            {index === 0 && (
                                <span className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-xs font-medium">
                                    Principal
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
