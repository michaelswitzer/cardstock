import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchGames,
  fetchGame,
  createGame,
  updateGame,
  deleteGame,
} from '../api/client';

export function useGames() {
  return useQuery({
    queryKey: ['games'],
    queryFn: () => fetchGames().then((r) => r.games),
  });
}

export function useGame(id: string | undefined) {
  return useQuery({
    queryKey: ['game', id],
    queryFn: () => fetchGame(id!),
    enabled: !!id,
  });
}

export function useCreateGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createGame,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['games'] }),
  });
}

export function useUpdateGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: Parameters<typeof updateGame>[1] & { id: string }) =>
      updateGame(id, updates),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['games'] });
      qc.invalidateQueries({ queryKey: ['game', vars.id] });
    },
  });
}

export function useDeleteGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteGame,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['games'] }),
  });
}
