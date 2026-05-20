/**
 * Example feature: kanban board emitting task-moved events.
 * The component depends on domain helpers, not the SDK directly.
 */
import { useCallback } from 'react';
import { trackTaskMoved } from '@/analytics/client';

interface MoveEvent {
  taskId: string;
  fromColumn: string;
  toColumn: string;
}

export function Board({ onMove }: { onMove: (e: MoveEvent) => void }) {
  const handleMove = useCallback(
    (e: MoveEvent) => {
      trackTaskMoved(e.taskId, e.fromColumn, e.toColumn);
      onMove(e);
    },
    [onMove],
  );
  // ... drag-drop wiring elided
  return <div data-testid="board" onClick={() => handleMove({ taskId: 't1', fromColumn: 'todo', toColumn: 'doing' })} />;
}
