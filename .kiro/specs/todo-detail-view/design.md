# Design Document

## Overview

This design document outlines the implementation of a todo detail view system for the existing calendar application. The feature transforms the current two-pane layout (sidebar + main content) into a three-pane layout (minimalistic sidebar + main calendar + detail pane) with enhanced todo selection and editing capabilities.

The design leverages the existing React/TypeScript architecture, TanStack Query for state management, and the established UI component library. The implementation focuses on maintaining the current design system while adding new functionality for todo selection, notes management, and detailed editing.

## Architecture

### Current Architecture Analysis
- **Frontend**: React with TypeScript, TanStack Query for data fetching
- **Backend**: Node.js with Drizzle ORM and PostgreSQL
- **UI Components**: Custom component library with shadcn/ui patterns
- **State Management**: React hooks with TanStack Query for server state
- **Styling**: Tailwind CSS with custom design tokens

### New Architecture Components

#### 1. Layout System
The application will transition from a two-pane to a three-pane layout:
- **Minimalistic Sidebar**: 64px width, icon-only navigation
- **Main Calendar View**: Flexible width, existing calendar functionality
- **Detail Pane**: 400px width, collapsible on smaller screens

#### 2. State Management Extensions
- **Selected Todo State**: Global state for currently selected todo
- **Detail Pane State**: Manages visibility and content of the detail pane
- **Notes Auto-save**: Debounced saving mechanism for notes

#### 3. Database Schema Extensions
The existing `tasks` table will be extended with a `notes` field:
```sql
ALTER TABLE tasks ADD COLUMN notes TEXT;
```

## Components and Interfaces

### 1. Layout Components

#### MinimalisticSidebar Component
```typescript
interface MinimalisticSidebarProps {
  currentView: CalendarView;
  onViewChange: (view: CalendarView) => void;
}
```
- **Responsibilities**: Display view navigation icons with tooltips
- **Width**: 64px fixed
- **Content**: Calendar icon, view selector icons (day, week, month, year)
- **Styling**: Modern, clean design with hover states and tooltips

#### TodoDetailPane Component
```typescript
interface TodoDetailPaneProps {
  selectedTodo: Task | null;
  onTodoUpdate: (taskId: string, updates: Partial<Task>) => void;
  onClose: () => void;
}
```
- **Responsibilities**: Display and edit selected todo details
- **Width**: 400px on desktop, full-screen overlay on mobile
- **Content**: Todo title, notes editor, priority selector, time editor
- **Features**: Auto-save notes, inline editing, validation

### 2. Enhanced Calendar Components

#### SelectableTodoItem Component
```typescript
interface SelectableTodoItemProps {
  task: Task;
  isSelected: boolean;
  onSelect: (taskId: string) => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
}
```
- **Responsibilities**: Render todo items with selection capability
- **Visual States**: Default, selected, completed, hover
- **Selection Indicator**: Border highlight, background change, or accent color

#### NotesEditor Component
```typescript
interface NotesEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoSave?: boolean;
}
```
- **Responsibilities**: Borderless text area for notes editing
- **Features**: Auto-resize, auto-save with debouncing, placeholder text
- **Styling**: TickTick-inspired borderless design

### 3. Utility Components

#### ResponsiveLayout Component
```typescript
interface ResponsiveLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  detail: React.ReactNode;
  isDetailOpen: boolean;
}
```
- **Responsibilities**: Manage three-pane layout across screen sizes
- **Breakpoints**: Desktop (3-pane), tablet (2-pane with overlay), mobile (single pane with navigation)

## Data Models

### Extended Task Interface
```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  notes?: string; // New field
  startTime: Date;
  endTime: Date;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
}
```

### Selection State Interface
```typescript
interface SelectionState {
  selectedTodoId: string | null;
  isDetailPaneOpen: boolean;
}
```

### Notes Auto-save Interface
```typescript
interface NotesAutoSave {
  taskId: string;
  notes: string;
  lastSaved: Date;
  isDirty: boolean;
}
```

## Error Handling

### Client-Side Error Handling
1. **Selection Errors**: Handle cases where selected todo no longer exists
2. **Notes Save Errors**: Retry mechanism with user notification
3. **Validation Errors**: Real-time validation for time ranges and required fields
4. **Network Errors**: Offline state handling and sync when reconnected

### Server-Side Error Handling
1. **Database Constraints**: Validate time ranges and required fields
2. **Concurrent Updates**: Handle optimistic locking for notes updates
3. **Invalid Todo IDs**: Return appropriate 404 responses
4. **Malformed Requests**: Validate request payloads

## Testing Strategy

### Unit Tests
1. **Component Tests**: Test each new component in isolation
   - MinimalisticSidebar rendering and interactions
   - TodoDetailPane content display and editing
   - NotesEditor auto-save functionality
   - SelectableTodoItem selection states

2. **Hook Tests**: Test custom hooks for state management
   - useSelectedTodo hook
   - useNotesAutoSave hook
   - useResponsiveLayout hook

3. **Utility Tests**: Test helper functions
   - Selection state management
   - Notes debouncing logic
   - Layout calculations

### Integration Tests
1. **Todo Selection Flow**: Test complete selection and detail display
2. **Notes Editing Flow**: Test notes creation, editing, and auto-save
3. **Priority/Time Editing**: Test inline editing of todo properties
4. **Responsive Behavior**: Test layout changes across screen sizes

### End-to-End Tests
1. **Complete User Journey**: Select todo → edit notes → change priority → verify persistence
2. **Cross-View Selection**: Maintain selection when switching calendar views
3. **Mobile Navigation**: Test detail pane access on mobile devices
4. **Auto-save Reliability**: Test notes persistence under various conditions

## Implementation Phases

### Phase 1: Database and API Updates
- Add notes column to tasks table
- Update API endpoints to handle notes field
- Extend validation schemas

### Phase 2: Core Components
- Implement MinimalisticSidebar component
- Create TodoDetailPane component
- Build NotesEditor with auto-save
- Add SelectableTodoItem component

### Phase 3: Layout Integration
- Implement ResponsiveLayout component
- Update main Calendar component for three-pane layout
- Add selection state management
- Integrate detail pane with existing views

### Phase 4: Enhanced Features
- Add priority and time editing in detail pane
- Implement responsive behavior
- Add keyboard shortcuts for selection
- Optimize performance for large todo lists

### Phase 5: Polish and Testing
- Comprehensive testing suite
- Accessibility improvements
- Performance optimizations
- User experience refinements

## Technical Considerations

### Performance Optimizations
1. **Virtual Scrolling**: For large todo lists in calendar views
2. **Debounced Auto-save**: Prevent excessive API calls during notes editing
3. **Memoization**: Optimize re-renders for selection state changes
4. **Lazy Loading**: Load detail pane content only when needed

### Accessibility
1. **Keyboard Navigation**: Full keyboard support for todo selection
2. **Screen Reader Support**: Proper ARIA labels and announcements
3. **Focus Management**: Logical focus flow between panes
4. **High Contrast**: Ensure selection indicators are visible

### Mobile Considerations
1. **Touch Interactions**: Optimize for touch-based selection
2. **Gesture Support**: Swipe gestures for detail pane navigation
3. **Viewport Management**: Handle virtual keyboard appearance
4. **Performance**: Optimize for mobile device constraints

### Browser Compatibility
1. **Modern Browsers**: Target ES2020+ features
2. **CSS Grid/Flexbox**: Use for responsive layout
3. **Local Storage**: Fallback for selection state persistence
4. **Progressive Enhancement**: Graceful degradation for older browsers