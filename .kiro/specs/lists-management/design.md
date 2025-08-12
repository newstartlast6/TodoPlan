# Design Document

## Overview

The Lists management feature introduces a dedicated interface for organizing tasks into custom lists, complementing the existing calendar-based task management. The design follows the established modern, minimalistic aesthetic with an orange theme, providing a 3-panel layout that maximizes productivity and user experience.

## Architecture

### Component Hierarchy

```
Lists Page
├── ResponsiveLayout
│   ├── ListsSidebar (Panel 1)
│   │   ├── ListsPanel
│   │   │   ├── CreateListButton
│   │   │   ├── ListItem[]
│   │   │   └── ListContextMenu
│   │   └── EmojiPicker
│   ├── ListDetailPanel (Panel 2)
│   │   ├── ListHeader
│   │   ├── AddTaskButton
│   │   ├── SelectableTodoItem[]
│   │   └── EmptyState
│   └── TodoDetailPane (Panel 3) [Reused]
```

### Data Flow

1. **Lists Management**: Lists are stored in a new `lists` table with relationships to existing tasks
2. **Task Association**: Tasks are extended with a `listId` field to associate them with lists
3. **State Management**: React Query manages server state, local state handles UI interactions
4. **Real-time Updates**: Optimistic updates provide immediate feedback, with server sync

## Components and Interfaces

### Core Components

#### ListsPage Component
```typescript
interface ListsPageProps {
  // Main container component
}

interface ListsState {
  selectedListId: string | null;
  selectedTodoId: string | null;
  isCreatingList: boolean;
  isEditingList: string | null;
}
```

#### ListsPanel Component
```typescript
interface ListsPanelProps {
  lists: List[];
  selectedListId: string | null;
  onListSelect: (listId: string) => void;
  onListCreate: (list: CreateListData) => void;
  onListUpdate: (listId: string, updates: Partial<List>) => void;
  onListDelete: (listId: string) => void;
}

interface List {
  id: string;
  name: string;
  emoji: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
  taskCount?: number;
}
```

#### ListDetailPanel Component
```typescript
interface ListDetailPanelProps {
  list: List | null;
  tasks: Task[];
  selectedTodoId: string | null;
  onTodoSelect: (todoId: string) => void;
  onTodoCreate: (todo: CreateTaskData) => void;
  onTodoUpdate: (todoId: string, updates: Partial<Task>) => void;
  onTodoDelete: (todoId: string) => void;
}
```

#### EmojiPicker Component
```typescript
interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  selectedEmoji?: string;
}

const EMOJI_CATEGORIES = {
  work: ['💼', '📊', '📈', '💻', '📝', '📋'],
  personal: ['🏠', '👤', '❤️', '🎯', '🌟', '✨'],
  projects: ['🚀', '🔧', '⚡', '🎨', '🔥', '💡'],
  health: ['🏃', '🥗', '💪', '🧘', '❤️‍🩹', '🌱']
};
```

### Layout Design

#### 3-Panel Layout Structure
```css
.lists-container {
  display: grid;
  grid-template-columns: 280px 1fr 400px;
  height: 100vh;
  gap: 1px;
  background: #f1f5f9;
}

.lists-panel {
  background: white;
  border-right: 1px solid #e2e8f0;
  overflow-y: auto;
}

.list-detail-panel {
  background: white;
  border-right: 1px solid #e2e8f0;
  overflow-y: auto;
}

.todo-detail-panel {
  background: white;
  overflow-y: auto;
}
```

#### Responsive Breakpoints
- **Desktop (>= 1024px)**: Full 3-panel layout
- **Tablet (768px - 1023px)**: Collapsible panels with overlay detail
- **Mobile (< 768px)**: Single panel navigation with slide transitions

## Data Models

### Lists Table Schema
```sql
CREATE TABLE lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📋',
  color TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Extended Tasks Schema
```sql
-- Add list_id column to existing tasks table
ALTER TABLE tasks ADD COLUMN list_id TEXT REFERENCES lists(id);

-- Index for performance
CREATE INDEX idx_tasks_list_id ON tasks(list_id);
```

### API Endpoints

#### Lists Management
```typescript
// GET /api/lists - Fetch all lists with task counts
// POST /api/lists - Create new list
// PUT /api/lists/:id - Update list
// DELETE /api/lists/:id - Delete list

interface CreateListRequest {
  name: string;
  emoji: string;
  color?: string;
}

interface UpdateListRequest {
  name?: string;
  emoji?: string;
  color?: string;
}
```

#### Tasks with Lists
```typescript
// GET /api/lists/:id/tasks - Fetch tasks for specific list
// POST /api/lists/:id/tasks - Create task in list
// PUT /api/tasks/:id/list - Move task to different list

interface CreateTaskInListRequest extends CreateTaskRequest {
  listId: string;
}
```

## User Interface Design

### Visual Theme
- **Primary Color**: Orange (#f97316) - consistent with week view
- **Background**: Clean white with subtle gray borders
- **Typography**: Same font stack as existing components
- **Spacing**: 8px grid system for consistent spacing
- **Shadows**: Subtle shadows for depth and hierarchy

### Panel-Specific Design

#### Panel 1: Lists Sidebar
```typescript
const ListItem = () => (
  <div className="flex items-center gap-3 p-3 hover:bg-orange-50 cursor-pointer rounded-lg">
    <span className="text-xl">{emoji}</span>
    <div className="flex-1">
      <div className="font-medium text-gray-900">{name}</div>
      <div className="text-sm text-gray-500">{taskCount} tasks</div>
    </div>
    <MoreVertical className="w-4 h-4 text-gray-400" />
  </div>
);
```

#### Panel 2: List Detail
```typescript
const ListHeader = () => (
  <div className="border-b border-gray-200 p-6">
    <div className="flex items-center gap-3 mb-2">
      <span className="text-2xl">{list.emoji}</span>
      <h2 className="text-xl font-semibold text-gray-900">{list.name}</h2>
    </div>
    <div className="text-sm text-gray-500">
      {completedTasks}/{totalTasks} tasks completed
    </div>
  </div>
);
```

#### Panel 3: Todo Detail
- Reuse existing `TodoDetailPane` component
- Maintain consistent styling and functionality
- Add list context information

## Error Handling

### Client-Side Error Handling
```typescript
interface ListsErrorBoundary {
  // Handle component crashes gracefully
  // Show user-friendly error messages
  // Provide recovery options
}

const errorStates = {
  LISTS_LOAD_FAILED: 'Failed to load lists',
  LIST_CREATE_FAILED: 'Failed to create list',
  LIST_DELETE_FAILED: 'Failed to delete list',
  TASKS_LOAD_FAILED: 'Failed to load tasks'
};
```

### Server-Side Validation
```typescript
const listValidation = {
  name: {
    required: true,
    minLength: 1,
    maxLength: 50
  },
  emoji: {
    required: true,
    pattern: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u
  }
};
```

## Testing Strategy

### Unit Tests
- Component rendering and props handling
- State management and user interactions
- API client functions and error handling
- Utility functions for list operations

### Integration Tests
- Full user workflows (create list → add tasks → manage)
- Cross-panel interactions and state synchronization
- Responsive layout behavior
- Error boundary functionality

### E2E Tests
```typescript
describe('Lists Management', () => {
  it('should create a new list with emoji', () => {
    // Test complete list creation workflow
  });
  
  it('should manage tasks within lists', () => {
    // Test task operations within list context
  });
  
  it('should handle list deletion with tasks', () => {
    // Test data integrity during deletion
  });
});
```

### Performance Considerations
- Virtualized lists for large datasets
- Optimistic updates for immediate feedback
- Debounced search and filtering
- Lazy loading of task details
- Efficient re-rendering with React.memo

## Accessibility

### Keyboard Navigation
- Tab order through panels and interactive elements
- Arrow key navigation within lists
- Enter/Space for selection and activation
- Escape for closing modals and canceling operations

### Screen Reader Support
- Proper ARIA labels and roles
- Live regions for dynamic content updates
- Descriptive text for emoji icons
- Clear focus indicators

### Visual Accessibility
- High contrast ratios for text and backgrounds
- Scalable text and UI elements
- Clear visual hierarchy
- Color-blind friendly design choices