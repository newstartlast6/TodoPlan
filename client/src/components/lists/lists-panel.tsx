import React, { useState } from 'react';
import { Plus, MoreVertical, Trash2, Edit3 } from 'lucide-react';
import { type ListWithTaskCount } from '@shared/list-types';
import { ListItem } from './list-item';
import { CreateListDialog } from './create-list-dialog';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { ContextMenu } from '../ui/context-menu';

interface ListsPanelProps {
  lists: ListWithTaskCount[];
  selectedListId: string | null;
  onListSelect: (listId: string) => void;
  onListCreate: (list: { name: string; emoji: string; color?: string }) => void;
  onListUpdate: (listId: string, updates: { name?: string; emoji?: string; color?: string }) => void;
  onListDelete: (listId: string) => void;
  isLoading?: boolean;
}

export function ListsPanel({
  lists,
  selectedListId,
  onListSelect,
  onListCreate,
  onListUpdate,
  onListDelete,
  isLoading = false,
}: ListsPanelProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [deleteConfirmListId, setDeleteConfirmListId] = useState<string | null>(null);
  const [contextMenuListId, setContextMenuListId] = useState<string | null>(null);

  const handleCreateList = (listData: { name: string; emoji: string; color?: string }) => {
    onListCreate(listData);
    setIsCreateDialogOpen(false);
  };

  const handleEditList = (listId: string) => {
    setEditingListId(listId);
    setContextMenuListId(null);
  };

  const handleDeleteList = (listId: string) => {
    setDeleteConfirmListId(listId);
    setContextMenuListId(null);
  };

  const confirmDeleteList = () => {
    if (deleteConfirmListId) {
      onListDelete(deleteConfirmListId);
      setDeleteConfirmListId(null);
    }
  };

  const handleUpdateList = (listId: string, updates: { name?: string; emoji?: string; color?: string }) => {
    onListUpdate(listId, updates);
    setEditingListId(null);
  };

  const contextMenuItems = [
    {
      id: 'rename',
      label: 'Rename List',
      icon: <Edit3 className="w-4 h-4" />,
      onClick: (listId: string) => handleEditList(listId),
    },
    {
      id: 'delete',
      label: 'Delete List',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: (listId: string) => handleDeleteList(listId),
      destructive: true,
    },
  ];

  const deleteConfirmList = lists.find(list => list.id === deleteConfirmListId);

  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Lists</h2>
          <button
            onClick={() => setIsCreateDialogOpen(true)}
            className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
            title="Create new list"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Lists */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4">
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-6 h-6 bg-gray-200 rounded"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : lists.length === 0 ? (
          <div className="p-4 text-center">
            <div className="text-gray-500 mb-4">
              <div className="text-4xl mb-2">📋</div>
              <p className="text-sm">No lists yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Create your first list to get started
              </p>
            </div>
            <button
              onClick={() => setIsCreateDialogOpen(true)}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors text-sm"
            >
              Create List
            </button>
          </div>
        ) : (
          <div className="p-2">
            {lists.map((list) => (
              <div key={list.id} className="relative">
                <ListItem
                  list={list}
                  isSelected={selectedListId === list.id}
                  isEditing={editingListId === list.id}
                  onClick={() => onListSelect(list.id)}
                  onEdit={(updates) => handleUpdateList(list.id, updates)}
                  onCancelEdit={() => setEditingListId(null)}
                  onContextMenu={() => setContextMenuListId(list.id)}
                />
                
                {contextMenuListId === list.id && (
                  <ContextMenu
                    items={contextMenuItems.map(item => ({
                      ...item,
                      onClick: () => item.onClick(list.id),
                    }))}
                    onClose={() => setContextMenuListId(null)}
                    position="right"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create List Dialog */}
      {isCreateDialogOpen && (
        <CreateListDialog
          onCreateList={handleCreateList}
          onClose={() => setIsCreateDialogOpen(false)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmList && (
        <ConfirmDialog
          title="Delete List"
          message={
            <div>
              <p>Are you sure you want to delete "{deleteConfirmList.name}"?</p>
              {deleteConfirmList.taskCount > 0 && (
                <p className="text-sm text-orange-600 mt-2">
                  This list contains {deleteConfirmList.taskCount} task(s). 
                  Tasks will not be deleted, but will no longer be associated with this list.
                </p>
              )}
            </div>
          }
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmDeleteList}
          onCancel={() => setDeleteConfirmListId(null)}
          destructive
        />
      )}
    </div>
  );
}