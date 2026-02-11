import { useQuery } from '@tanstack/react-query';
import { discoverSheetTabs } from '../api/client';

export function useSheetTabs(url: string | undefined) {
  return useQuery({
    queryKey: ['sheetTabs', url],
    queryFn: () => discoverSheetTabs(url!).then((r) => r.tabs),
    enabled: !!url,
  });
}
