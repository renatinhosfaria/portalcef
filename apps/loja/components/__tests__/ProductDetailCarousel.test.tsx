import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProductDetailCarousel } from '../ProductDetailCarousel';

describe('ProductDetailCarousel', () => {
  const mockImages = [
    'https://example.com/img1.jpg',
    'https://example.com/img2.jpg',
    'https://example.com/img3.jpg',
  ];

  it('should render main image with thumbnails', () => {
    render(
      <ProductDetailCarousel
        images={mockImages}
        productName="Test Product"
      />
    );

    // Should have navigation buttons (2 arrows)
    expect(screen.getByLabelText('Imagem anterior')).toBeInTheDocument();
    expect(screen.getByLabelText('Próxima imagem')).toBeInTheDocument();

    // Should have thumbnails (3 buttons for each image)
    const thumbnails = screen.getAllByRole('button').filter(btn =>
      btn.getAttribute('aria-label')?.includes('Ver imagem')
    );
    expect(thumbnails).toHaveLength(3);

    // Should show counter
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('should change image on thumbnail click', () => {
    render(
      <ProductDetailCarousel
        images={mockImages}
        productName="Test Product"
      />
    );

    const secondThumb = screen.getByLabelText('Ver imagem 2');
    fireEvent.click(secondThumb);

    // Counter should update
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('should highlight selected thumbnail', () => {
    render(
      <ProductDetailCarousel
        images={mockImages}
        productName="Test Product"
      />
    );

    const firstThumb = screen.getByLabelText('Ver imagem 1');
    expect(firstThumb).toHaveClass('border-brand-600');

    const secondThumb = screen.getByLabelText('Ver imagem 2');
    fireEvent.click(secondThumb);

    expect(secondThumb).toHaveClass('border-brand-600');
    expect(firstThumb).not.toHaveClass('border-brand-600');
  });

  it('should show image counter', () => {
    render(
      <ProductDetailCarousel
        images={mockImages}
        productName="Test Product"
      />
    );

    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('should hide navigation for single image', () => {
    render(
      <ProductDetailCarousel
        images={[mockImages[0]]}
        productName="Test Product"
      />
    );

    expect(screen.queryByLabelText('Imagem anterior')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Próxima imagem')).not.toBeInTheDocument();
    expect(screen.queryByText('/ 1')).not.toBeInTheDocument();
  });

  it('should navigate with arrow buttons', () => {
    render(
      <ProductDetailCarousel
        images={mockImages}
        productName="Test Product"
      />
    );

    const nextBtn = screen.getByLabelText('Próxima imagem');
    fireEvent.click(nextBtn);

    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    const prevBtn = screen.getByLabelText('Imagem anterior');
    fireEvent.click(prevBtn);

    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('should wrap around at start/end', () => {
    render(
      <ProductDetailCarousel
        images={mockImages}
        productName="Test Product"
      />
    );

    const prevBtn = screen.getByLabelText('Imagem anterior');
    fireEvent.click(prevBtn);

    // Should wrap to last image
    expect(screen.getByText('3 / 3')).toBeInTheDocument();

    const nextBtn = screen.getByLabelText('Próxima imagem');
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);

    // Should wrap back to first
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('should announce image changes to screen readers', () => {
    render(
      <ProductDetailCarousel
        images={mockImages}
        productName="Test Product"
      />
    );

    // Should have aria-live region
    const liveRegion = screen.getByText(/Exibindo imagem 1 de 3/i);
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveClass('sr-only');
  });

  it('should use fallback image when images array is empty', () => {
    const fallbackImage = 'https://example.com/fallback.jpg';
    render(
      <ProductDetailCarousel
        images={[]}
        fallbackImage={fallbackImage}
        productName="Test Product"
      />
    );

    const img = screen.getByRole('img', { name: /imagem 1 de 1/i });
    expect(img).toBeInTheDocument();
  });

  it('should show placeholder when no images or fallback', () => {
    render(
      <ProductDetailCarousel
        images={[]}
        productName="Test Product"
      />
    );

    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toContain('ui-avatars.com');
  });

  it('should have proper aria attributes for accessibility', () => {
    render(
      <ProductDetailCarousel
        images={mockImages}
        productName="Test Product"
      />
    );

    // Check aria-current on selected thumbnail
    const firstThumb = screen.getByLabelText('Ver imagem 1');
    expect(firstThumb).toHaveAttribute('aria-current', 'true');

    const secondThumb = screen.getByLabelText('Ver imagem 2');
    expect(secondThumb).not.toHaveAttribute('aria-current');

    fireEvent.click(secondThumb);
    expect(secondThumb).toHaveAttribute('aria-current', 'true');
    expect(firstThumb).not.toHaveAttribute('aria-current');
  });
});
