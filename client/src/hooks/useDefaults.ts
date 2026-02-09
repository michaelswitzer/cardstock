import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchDefaults, saveDefaults } from '../api/client';
import type { LocalDefaults } from '@cardmaker/shared';

export function useDefaults() {
  return useQuery({
    queryKey: ['defaults'],
    queryFn: fetchDefaults,
    staleTime: Infinity,
  });
}

export function useSaveDefaults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveDefaults,
    onSuccess: (data) => {
      queryClient.setQueryData<LocalDefaults>(['defaults'], data);
    },
  });
}
