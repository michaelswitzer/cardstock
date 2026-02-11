import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchDecks,
  fetchDeck,
  createDeck,
  updateDeck,
  deleteDeck,
} from '../api/client';
import type { FieldMapping } from '@cardmaker/shared';

export function useDecks(gameId: string | undefined) {
  return useQuery({
    queryKey: ['decks', gameId],
    queryFn: () => fetchDecks(gameId!).then((r) => r.decks),
    enabled: !!gameId,
  });
}

export function useDeck(id: string | undefined) {
  return useQuery({
    queryKey: ['deck', id],
    queryFn: () => fetchDeck(id!),
    enabled: !!id,
  });
}

export function useCreateDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      gameId,
      ...input
    }: {
      gameId: string;
      name: string;
      sheetTabGid: string;
      sheetTabName: string;
      templateId: string;
      mapping: FieldMapping;
      cardBackImage?: string;
    }) => createDeck(gameId, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['decks', vars.gameId] });
      qc.invalidateQueries({ queryKey: ['game', vars.gameId] });
      qc.invalidateQueries({ queryKey: ['games'] });
    },
  });
}

export function useUpdateDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: Parameters<typeof updateDeck>[1] & { id: string }) =>
      updateDeck(id, updates),
    onSuccess: (deck) => {
      qc.invalidateQueries({ queryKey: ['deck', deck.id] });
      qc.invalidateQueries({ queryKey: ['decks', deck.gameId] });
      qc.invalidateQueries({ queryKey: ['game', deck.gameId] });
    },
  });
}

export function useDeleteDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteDeck,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['decks'] });
      qc.invalidateQueries({ queryKey: ['games'] });
    },
  });
}
