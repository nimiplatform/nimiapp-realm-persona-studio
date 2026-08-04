import { useEffect, useState } from 'react';
import {
  CREATIVE_ASSET_HISTORY_UPDATED_EVENT,
  loadLocalCreativeAssetHistory,
  type CreativeAssetHistoryRecord,
} from './creative-asset-history.js';

export type LocalCreativeAssetHistoryState = {
  records: CreativeAssetHistoryRecord[];
  loading: boolean;
  unavailable: boolean;
  unavailableCount: number;
};

export function useLocalCreativeAssetHistory(personaId: string): LocalCreativeAssetHistoryState {
  const [state, setState] = useState<LocalCreativeAssetHistoryState>({
    records: [],
    loading: true,
    unavailable: false,
    unavailableCount: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const result = await loadLocalCreativeAssetHistory(personaId);
      if (cancelled) return;
      setState(result.ok
        ? {
          records: result.records,
          loading: false,
          unavailable: false,
          unavailableCount: result.unavailableCount,
        }
        : {
          records: [],
          loading: false,
          unavailable: true,
          unavailableCount: 0,
        });
    };
    const handleUpdated = () => void refresh();
    void refresh();
    window.addEventListener(CREATIVE_ASSET_HISTORY_UPDATED_EVENT, handleUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(CREATIVE_ASSET_HISTORY_UPDATED_EVENT, handleUpdated);
    };
  }, [personaId]);

  return state;
}
