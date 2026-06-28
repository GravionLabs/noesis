import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  withComputed,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of, interval, Subject, takeUntil } from 'rxjs';
import type { Job } from '../models/job.model';
import { NoesisApiService } from '../services/noesis-api.service';

interface JobsState {
  jobs: Job[];
  loading: boolean;
  tick: number;
}

const initialState: JobsState = {
  jobs: [],
  loading: false,
  tick: Date.now(),
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
    let tickInterval: ReturnType<typeof setInterval> | null = null;

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

    function startTick(): void {
      if (tickInterval) return;
      tickInterval = setInterval(() => {
        patchState(_store, { tick: Date.now() });
      }, 1000);
    }

    function stopTick(): void {
      if (tickInterval) {
        clearInterval(tickInterval);
        tickInterval = null;
      }
    }

    return {
      loadJobs,
      startTick,
      stopTick,
      retryJob(id: string): void {
        api.retryJob(id).subscribe({ next: () => loadJobs() });
      },
      cancelJob(id: string): void {
        api.cancelJob(id).subscribe({ next: () => loadJobs() });
      },
      connectSse(): void {
        disconnectSseImpl();
        eventSource = new EventSource(api.getJobStreamUrl());
        eventSource.addEventListener('job', (e: MessageEvent) => {
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
          // EventSource reconnects automatically
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
