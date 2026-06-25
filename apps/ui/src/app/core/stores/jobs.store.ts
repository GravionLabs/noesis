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
import type { Job } from '../models/job.model';
import { NoesisApiService } from '../services/noesis-api.service';

interface JobsState {
  jobs: Job[];
  loading: boolean;
}

const initialState: JobsState = {
  jobs: [],
  loading: false,
};

export const JobsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((state) => ({
    runningJobs: () => state.jobs().filter((j) => j.status === 'running'),
    failedJobs: () => state.jobs().filter((j) => j.status === 'failed'),
    pendingJobs: () => state.jobs().filter((j) => j.status === 'pending'),
    hasActiveJobs: () =>
      state.jobs().some((j) => j.status === 'running' || j.status === 'pending'),
  })),
  withMethods((_store, api = inject(NoesisApiService)) => {
    let eventSource: EventSource | null = null;

    const loadJobs = rxMethod<void>(
      pipe(
        tap(() => patchState(_store, { loading: true })),
        switchMap(() =>
          api.listJobs().pipe(
            tap((jobs) => patchState(_store, { jobs, loading: false })),
            catchError(() => {
              patchState(_store, { loading: false });
              return of([]);
            }),
          ),
        ),
      ),
    );

    return {
      loadJobs,
      retryJob(id: string): void {
        api.retryJob(id).subscribe({ next: () => loadJobs() });
      },
      /**
       * Opens an SSE connection to /api/jobs/stream. Each incoming event
       * updates the matching job in state by id, so consumers always see the
       * latest status without polling. Relies on EventSource's built-in
       * reconnect logic. Call loadJobs() first for the initial snapshot.
       */
      connectSse(): void {
        disconnectSseImpl();
        eventSource = new EventSource(api.getJobStreamUrl());
        eventSource.addEventListener('message', (e: MessageEvent) => {
          try {
            const updated: Partial<Job> & { id: string } = JSON.parse(e.data);
            patchState(_store, (state) => ({
              jobs: state.jobs.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)),
            }));
          } catch {
            // ignore malformed frames
          }
        });
        eventSource.addEventListener('error', () => {
          // EventSource reconnects automatically; no action needed here.
        });
      },
      disconnectSse: disconnectSseImpl,
    };

    function disconnectSseImpl() {
      eventSource?.close();
      eventSource = null;
    }
  }),
);
