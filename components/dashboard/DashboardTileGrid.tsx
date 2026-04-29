import React from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DASHBOARD_TILE_REGISTRY,
  moveDashboardTile,
  type DashboardPreference,
  type DashboardRole,
  type DashboardTileId,
  type DashboardTilePreference,
  type DashboardTileSize,
} from '../../utils/dashboardPreferences';

interface DashboardTileGridProps {
  role: DashboardRole;
  preference: DashboardPreference;
  isEditing: boolean;
  onPreferenceChange: (preference: DashboardPreference) => void;
  renderTile: (tileId: DashboardTileId) => React.ReactNode;
}

const sizeClasses: Record<DashboardTileSize, string> = {
  small: 'md:col-span-1',
  wide: 'md:col-span-2',
  tall: 'md:col-span-1 md:row-span-2',
  large: 'md:col-span-2 md:row-span-2',
};

const minHeightClasses: Record<DashboardTileSize, string> = {
  small: 'min-h-[11rem]',
  wide: 'min-h-[14rem]',
  tall: 'min-h-[22rem]',
  large: 'min-h-[22rem]',
};

const nextSize = (tile: DashboardTilePreference): DashboardTileSize => {
  const allowedSizes = DASHBOARD_TILE_REGISTRY[tile.id].allowedSizes;
  const currentIndex = Math.max(0, allowedSizes.indexOf(tile.size));
  return allowedSizes[(currentIndex + 1) % allowedSizes.length];
};

const SortableTile: React.FC<{
  tile: DashboardTilePreference;
  role: DashboardRole;
  isEditing: boolean;
  onPreferenceChange: (preference: DashboardPreference) => void;
  preference: DashboardPreference;
  children: React.ReactNode;
}> = ({ tile, role, isEditing, onPreferenceChange, preference, children }) => {
  const sortable = useSortable({ id: tile.id, disabled: !isEditing });
  const definition = DASHBOARD_TILE_REGISTRY[tile.id];

  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  const moveBy = (direction: -1 | 1) => {
    const visibleTiles = preference.tiles.filter(item => !item.hidden);
    const currentIndex = visibleTiles.findIndex(item => item.id === tile.id);
    const target = visibleTiles[currentIndex + direction];
    if (!target) return;
    onPreferenceChange(moveDashboardTile(preference, tile.id, target.id));
  };

  return (
    <section
      ref={sortable.setNodeRef}
      style={style}
      className={`${sizeClasses[tile.size]} ${minHeightClasses[tile.size]} ${sortable.isDragging ? 'z-20 opacity-80' : ''}`}
    >
      <div className="h-full overflow-hidden rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm transition-all dark:border-white/5 dark:bg-slate-900">
        {isEditing && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-white/5">
            <button
              type="button"
              {...sortable.attributes}
              {...sortable.listeners}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
              aria-label={`Drag ${definition.title}`}
            >
              <i className="fa-solid fa-grip-lines"></i>
              Move
            </button>
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" onClick={() => moveBy(-1)} className="h-9 w-9 rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300" aria-label={`Move ${definition.title} earlier`}>
                <i className="fa-solid fa-arrow-left"></i>
              </button>
              <button type="button" onClick={() => moveBy(1)} className="h-9 w-9 rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300" aria-label={`Move ${definition.title} later`}>
                <i className="fa-solid fa-arrow-right"></i>
              </button>
              <button
                type="button"
                onClick={() => onPreferenceChange({
                  ...preference,
                  tiles: preference.tiles.map(item => item.id === tile.id ? { ...item, size: nextSize(item) } : item),
                })}
                className="rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-300"
              >
                {tile.size}
              </button>
              <button
                type="button"
                onClick={() => onPreferenceChange({
                  ...preference,
                  tiles: preference.tiles.map(item => item.id === tile.id ? { ...item, hidden: true } : item),
                })}
                className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300"
                aria-label={`Hide ${definition.title}`}
              >
                <i className="fa-solid fa-eye-slash"></i>
              </button>
            </div>
          </div>
        )}
        {children}
      </div>
    </section>
  );
};

const DashboardTileGrid: React.FC<DashboardTileGridProps> = ({
  role,
  preference,
  isEditing,
  onPreferenceChange,
  renderTile,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const visibleTiles = preference.tiles.filter(tile => !tile.hidden);

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = event.active.id as DashboardTileId;
    const overId = event.over?.id as DashboardTileId | undefined;
    if (!overId || activeId === overId) return;
    onPreferenceChange(moveDashboardTile(preference, activeId, overId));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={visibleTiles.map(tile => tile.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {visibleTiles.map(tile => (
            <SortableTile
              key={tile.id}
              tile={tile}
              role={role}
              isEditing={isEditing}
              onPreferenceChange={onPreferenceChange}
              preference={preference}
            >
              {renderTile(tile.id)}
            </SortableTile>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default DashboardTileGrid;
