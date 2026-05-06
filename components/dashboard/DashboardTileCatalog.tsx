import React from 'react';
import {
  DASHBOARD_TILE_REGISTRY,
  addDashboardTile,
  getAvailableDashboardTiles,
  hideDashboardTile,
  type DashboardPreference,
  type DashboardRole,
} from '../../utils/dashboardPreferences';

interface DashboardTileCatalogProps {
  role: DashboardRole;
  preference: DashboardPreference;
  onPreferenceChange: (preference: DashboardPreference) => void;
}

const DashboardTileCatalog: React.FC<DashboardTileCatalogProps> = ({
  role,
  preference,
  onPreferenceChange,
}) => {
  const availableTiles = getAvailableDashboardTiles(role);

  return (
    <div className="rounded-[20px] border border-dashed border-slate-300 bg-white/70 p-3 dark:border-white/10 dark:bg-slate-900/70 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400">Tile catalog</p>
          <h3 className="mt-1 text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Add or restore tiles</h3>
        </div>
        <i className="fa-solid fa-layer-group text-slate-300 dark:text-slate-700"></i>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {availableTiles.map(tile => {
          const current = preference.tiles.find(item => item.id === tile.id);
          const isVisible = current && !current.hidden;
          return (
            <div
              key={tile.id}
              className={`min-h-24 rounded-2xl border p-4 text-left transition-all active:scale-[0.99] ${
                isVisible
                  ? 'cursor-default border-slate-100 bg-slate-50 text-slate-300 dark:border-white/5 dark:bg-slate-950/50 dark:text-slate-600'
                  : 'border-slate-200 bg-white hover:border-teal-400 hover:shadow-sm dark:border-white/10 dark:bg-slate-950/40 dark:hover:border-teal-500'
              }`}
            >
              <p className="text-xs font-black text-slate-900 dark:text-white">{DASHBOARD_TILE_REGISTRY[tile.id].title}</p>
              <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-relaxed text-slate-500 dark:text-slate-400">{tile.description}</p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPreferenceChange(addDashboardTile(preference, role, tile.id))}
                  className="rounded-lg bg-teal-50 px-2 py-1.5 text-[9px] font-black uppercase tracking-widest text-teal-700 disabled:opacity-40 dark:bg-teal-950/30 dark:text-teal-300"
                  disabled={isVisible}
                >
                  {current?.hidden ? 'Show' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => onPreferenceChange(hideDashboardTile(preference, role, tile.id))}
                  className="rounded-lg bg-slate-100 px-2 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300"
                  disabled={!isVisible}
                >
                  Hide
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardTileCatalog;
