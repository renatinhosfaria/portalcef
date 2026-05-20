import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FilterSidebar } from '../FilterSidebar';

describe('FilterSidebar', () => {
  it('exibe pré-venda como categoria dedicada', () => {
    const onCategoryChange = vi.fn();

    render(
      <FilterSidebar
        activeCategory=""
        onCategoryChange={onCategoryChange}
        activeSize=""
        onSizeChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /pré-venda/i }));

    expect(onCategoryChange).toHaveBeenCalledWith('PRE_VENDA');
  });
});
