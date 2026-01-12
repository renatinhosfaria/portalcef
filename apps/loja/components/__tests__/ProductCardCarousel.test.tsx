import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProductCardCarousel } from '../ProductCardCarousel';

describe('ProductCardCarousel', () => {
  const mockImages = [
    'https://example.com/img1.jpg',
    'https://example.com/img2.jpg',
    'https://example.com/img3.jpg',
  ];

  it('should render single image without navigation', () => {
    render(
      <ProductCardCarousel
        images={[mockImages[0]]}
        productName="Test Product"
      />
    );

    expect(screen.queryByLabelText('Imagem anterior')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Próxima imagem')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Ver imagem 1')).not.toBeInTheDocument();
  });

  it('should render multiple images with dots', () => {
    render(
      <ProductCardCarousel
        images={mockImages}
        productName="Test Product"
      />
    );

    // Should have navigation arrows
    expect(screen.getByLabelText('Imagem anterior')).toBeInTheDocument();
    expect(screen.getByLabelText('Próxima imagem')).toBeInTheDocument();

    // Should have dot indicators
    const dots = screen.getAllByRole('button').filter(btn =>
      btn.getAttribute('aria-label')?.includes('Ver imagem')
    );
    expect(dots).toHaveLength(3);
  });

  it('should navigate to next image on arrow click', async () => {
    render(
      <ProductCardCarousel
        images={mockImages}
        productName="Test Product"
      />
    );

    const nextBtn = screen.getByLabelText('Próxima imagem');
    fireEvent.click(nextBtn);

    // After click, second dot should be active (has bg-white w-4 class)
    const dots = screen.getAllByRole('button').filter(btn =>
      btn.getAttribute('aria-label')?.includes('Ver imagem')
    );
    expect(dots[1]).toHaveClass('bg-white');
  });

  it('should navigate to previous image on arrow click', async () => {
    render(
      <ProductCardCarousel
        images={mockImages}
        productName="Test Product"
      />
    );

    const nextBtn = screen.getByLabelText('Próxima imagem');
    fireEvent.click(nextBtn);

    const prevBtn = screen.getByLabelText('Imagem anterior');
    fireEvent.click(prevBtn);

    // Should be back to first dot
    const dots = screen.getAllByRole('button').filter(btn =>
      btn.getAttribute('aria-label')?.includes('Ver imagem')
    );
    expect(dots[0]).toHaveClass('bg-white');
  });

  it('should wrap around from last to first image', () => {
    render(
      <ProductCardCarousel
        images={mockImages}
        productName="Test Product"
      />
    );

    const nextBtn = screen.getByLabelText('Próxima imagem');

    // Click next 3 times to go through all images and wrap
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);

    // Should be back to first image
    const dots = screen.getAllByRole('button').filter(btn =>
      btn.getAttribute('aria-label')?.includes('Ver imagem')
    );
    expect(dots[0]).toHaveClass('bg-white');
  });

  it('should change image on dot click', () => {
    render(
      <ProductCardCarousel
        images={mockImages}
        productName="Test Product"
      />
    );

    const secondDot = screen.getByLabelText('Ver imagem 2');
    fireEvent.click(secondDot);

    // Second dot should now be active
    expect(secondDot).toHaveClass('bg-white');
  });

  it('should show placeholder when no images provided', () => {
    render(
      <ProductCardCarousel
        images={[]}
        productName="Test Product"
      />
    );

    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toContain('ui-avatars.com');
  });

  it('should use fallback image if images array is empty', () => {
    const fallbackImage = 'https://example.com/fallback.jpg';
    render(
      <ProductCardCarousel
        images={[]}
        fallbackImage={fallbackImage}
        productName="Test Product"
      />
    );

    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toContain('fallback.jpg');
  });

  it('should have proper aria labels for accessibility', () => {
    render(
      <ProductCardCarousel
        images={mockImages}
        productName="Test Product"
      />
    );

    expect(screen.getByLabelText('Imagem anterior')).toBeInTheDocument();
    expect(screen.getByLabelText('Próxima imagem')).toBeInTheDocument();
    expect(screen.getByLabelText('Ver imagem 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Ver imagem 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Ver imagem 3')).toBeInTheDocument();
  });
});
