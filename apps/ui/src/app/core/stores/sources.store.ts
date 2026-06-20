import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  withComputed,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import type { Source, CreateSourceDto, UpdateSourceDto } from '../models/source.model';
import { NoesisApiService } from '../services/noesis-api.service';

interface SourcesState {
  sources: Source[];
  loading: boolean;
  error: string | null;
}

const initialState: SourcesState = {
  sources: [],
  loading: false,
  error: null,
};

export const SourcesStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((state) => ({
    sourceCount: () => state.sources().length,
    enabledSources: () => state.sources().filter((s) => s.enabled),
    sourceById:
      () =>
      (id: string): Source | undefined =>
        state.sources().find((s) => s.id === id),
  })),
  withMethods((_store, api = inject(NoesisApiService)) => {
    const loadSources = rxMethod<void>(
      pipe(
        tap(() => patchState(_store, { loading: true, error: null })),
        switchMap(() =>
          api.listSources().pipe(
            tap((sources) => patchState(_store, { sources, loading: false })),
            catchError((err: Error) => {
              patchState(_store, { error: err.message, loading: false });
              return of([]);
            }),
          ),
        ),
      ),
    );

    return {
      loadSources,
      createSource(dto: CreateSourceDto): void {
        patchState(_store, { loading: true, error: null });
        api.createSource(dto).subscribe({
          next: (source) =>
            patchState(_store, {
              sources: [..._store.sources(), source],
              loading: false,
            }),
          error: (err: Error) =>
            patchState(_store, { error: err.message, loading: false }),
        });
      },
      updateSource(id: string, dto: UpdateSourceDto): void {
        const previous = _store.sources();
        patchState(_store, {
          sources: _store.sources().map((s) => (s.id === id ? { ...s, ...dto } : s)),
        });
        api.updateSource(id, dto).subscribe({
          next: (source) =>
            patchState(_store, {
              sources: _store.sources().map((s) => (s.id === id ? source : s)),
            }),
          error: (err: Error) =>
            patchState(_store, { sources: previous, error: err.message }),
        });
      },
      deleteSource(id: string): void {
        const previous = _store.sources();
        patchState(_store, {
          sources: _store.sources().filter((s) => s.id !== id),
        });
        api.deleteSource(id).subscribe({
          next: () => {},
          error: (err: Error) =>
            patchState(_store, { sources: previous, error: err.message }),
        });
      },
    };
  }),
);
