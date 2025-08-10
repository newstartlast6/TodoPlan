import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DurationPicker, CompactDurationPicker } from '../duration-picker';

describe('DurationPicker', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with placeholder when no value', () => {
    render(
      <DurationPicker
        onChange={mockOnChange}
        placeholder="Select duration"
      />
    );

    expect(screen.getByText('Select duration')).toBeInTheDocument();
  });

  it('should display formatted duration when value is set', () => {
    render(
      <DurationPicker
        value={90} // 1h 30m
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('1h 30m')).toBeInTheDocument();
  });

  it('should open popover when clicked', async () => {
    render(
      <DurationPicker
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Estimated Duration')).toBeInTheDocument();
      expect(screen.getByText('Quick Select')).toBeInTheDocument();
    });
  });

  it('should handle preset selection', async () => {
    render(
      <DurationPicker
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('1 hour')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('1 hour'));

    expect(mockOnChange).toHaveBeenCalledWith(60);
  });

  it('should handle custom duration input', async () => {
    render(
      <DurationPicker
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByLabelText('Hours')).toBeInTheDocument();
    });

    const hoursInput = screen.getByLabelText('Hours');
    const minutesInput = screen.getByLabelText('Minutes');

    fireEvent.change(hoursInput, { target: { value: '2' } });
    fireEvent.change(minutesInput, { target: { value: '30' } });

    fireEvent.click(screen.getByText('Set Custom Duration'));

    expect(mockOnChange).toHaveBeenCalledWith(150); // 2h 30m = 150 minutes
  });

  it('should show remove option when value exists', async () => {
    render(
      <DurationPicker
        value={60}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Remove Estimate')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Remove Estimate'));

    expect(mockOnChange).toHaveBeenCalledWith(0);
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <DurationPicker
        onChange={mockOnChange}
        disabled={true}
      />
    );

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should format duration correctly', () => {
    const { rerender } = render(
      <DurationPicker
        value={30}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('30m')).toBeInTheDocument();

    rerender(
      <DurationPicker
        value={60}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('1h')).toBeInTheDocument();

    rerender(
      <DurationPicker
        value={90}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('1h 30m')).toBeInTheDocument();
  });
});

describe('CompactDurationPicker', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render compact select', () => {
    render(
      <CompactDurationPicker
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Estimate')).toBeInTheDocument();
  });

  it('should display formatted value when set', () => {
    render(
      <CompactDurationPicker
        value={120}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('2h 0m')).toBeInTheDocument();
  });

  it('should handle selection change', async () => {
    render(
      <CompactDurationPicker
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('1 hour')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('1 hour'));

    expect(mockOnChange).toHaveBeenCalledWith(60);
  });

  it('should handle no estimate selection', async () => {
    render(
      <CompactDurationPicker
        value={60}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('No estimate')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('No estimate'));

    expect(mockOnChange).toHaveBeenCalledWith(0);
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <CompactDurationPicker
        onChange={mockOnChange}
        disabled={true}
      />
    );

    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});