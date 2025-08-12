import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmojiPicker } from '../emoji-picker';
import { EMOJI_CATEGORIES } from '@shared/list-types';

describe('EmojiPicker', () => {
  const mockOnEmojiSelect = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default category', () => {
    render(<EmojiPicker onEmojiSelect={mockOnEmojiSelect} />);
    
    expect(screen.getByText('Choose an emoji')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search emojis...')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('displays category tabs', () => {
    render(<EmojiPicker onEmojiSelect={mockOnEmojiSelect} />);
    
    Object.values(EMOJI_CATEGORIES).forEach(category => {
      expect(screen.getByText(category.name)).toBeInTheDocument();
    });
  });

  it('switches categories when tab is clicked', () => {
    render(<EmojiPicker onEmojiSelect={mockOnEmojiSelect} />);
    
    const personalTab = screen.getByText('Personal');
    fireEvent.click(personalTab);
    
    // Check if personal category is now active (has active styling)
    expect(personalTab).toHaveClass('bg-orange-100');
  });

  it('calls onEmojiSelect when emoji is clicked', () => {
    render(<EmojiPicker onEmojiSelect={mockOnEmojiSelect} />);
    
    // Find the first emoji in the work category
    const firstEmoji = EMOJI_CATEGORIES.work.emojis[0];
    const emojiButton = screen.getByTitle(firstEmoji);
    
    fireEvent.click(emojiButton);
    
    expect(mockOnEmojiSelect).toHaveBeenCalledWith(firstEmoji);
  });

  it('highlights selected emoji', () => {
    const selectedEmoji = EMOJI_CATEGORIES.work.emojis[0];
    render(
      <EmojiPicker 
        onEmojiSelect={mockOnEmojiSelect} 
        selectedEmoji={selectedEmoji}
      />
    );
    
    const emojiButton = screen.getByTitle(selectedEmoji);
    expect(emojiButton).toHaveClass('bg-orange-100', 'ring-2', 'ring-orange-500');
  });

  it('shows selected emoji in footer', () => {
    const selectedEmoji = EMOJI_CATEGORIES.work.emojis[0];
    render(
      <EmojiPicker 
        onEmojiSelect={mockOnEmojiSelect} 
        selectedEmoji={selectedEmoji}
      />
    );
    
    expect(screen.getByText('Selected:')).toBeInTheDocument();
    expect(screen.getByText(selectedEmoji)).toBeInTheDocument();
  });

  it('clears selected emoji when clear button is clicked', () => {
    const selectedEmoji = EMOJI_CATEGORIES.work.emojis[0];
    render(
      <EmojiPicker 
        onEmojiSelect={mockOnEmojiSelect} 
        selectedEmoji={selectedEmoji}
      />
    );
    
    const clearButton = screen.getByText('Clear');
    fireEvent.click(clearButton);
    
    expect(mockOnEmojiSelect).toHaveBeenCalledWith('');
  });

  it('filters emojis based on search term', () => {
    render(<EmojiPicker onEmojiSelect={mockOnEmojiSelect} />);
    
    const searchInput = screen.getByPlaceholderText('Search emojis...');
    fireEvent.change(searchInput, { target: { value: 'work' } });
    
    // Category tabs should be hidden during search
    expect(screen.queryByText('Work')).not.toBeInTheDocument();
  });

  it('shows no results message for invalid search', () => {
    render(<EmojiPicker onEmojiSelect={mockOnEmojiSelect} />);
    
    const searchInput = screen.getByPlaceholderText('Search emojis...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    
    expect(screen.getByText(/No emojis found for "nonexistent"/)).toBeInTheDocument();
    expect(screen.getByText('Try a different search term')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <EmojiPicker 
        onEmojiSelect={mockOnEmojiSelect} 
        onClose={mockOnClose}
      />
    );
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not show close button when onClose is not provided', () => {
    render(<EmojiPicker onEmojiSelect={mockOnEmojiSelect} />);
    
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
  });

  it('displays all emojis from all categories during search', () => {
    render(<EmojiPicker onEmojiSelect={mockOnEmojiSelect} />);
    
    const searchInput = screen.getByPlaceholderText('Search emojis...');
    fireEvent.change(searchInput, { target: { value: 'work' } });
    
    // Should show emojis from work category
    EMOJI_CATEGORIES.work.emojis.forEach(emoji => {
      expect(screen.getByTitle(emoji)).toBeInTheDocument();
    });
  });

  it('maintains emoji selection across category switches', () => {
    const selectedEmoji = EMOJI_CATEGORIES.personal.emojis[0];
    render(
      <EmojiPicker 
        onEmojiSelect={mockOnEmojiSelect} 
        selectedEmoji={selectedEmoji}
      />
    );
    
    // Switch to personal category
    const personalTab = screen.getByText('Personal');
    fireEvent.click(personalTab);
    
    // Selected emoji should still be highlighted
    const emojiButton = screen.getByTitle(selectedEmoji);
    expect(emojiButton).toHaveClass('bg-orange-100', 'ring-2', 'ring-orange-500');
  });
});