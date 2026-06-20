import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  withComputed,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, interval, catchError, of, Subscription } from 'rxjs';
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
    let refreshSub: Subscription | null = null;

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
      startAutoRefresh(intervalMs = 5000): void {
        stopAutoRefreshImpl();
        refreshSub = interval(intervalMs).subscribe(() => loadJobs());
      },
      stopAutoRefresh: stopAutoRefreshImpl,
    };

    function stopAutoRefreshImpl() {
      refreshSub?.unsubscribe();
      refreshSub = null;
    }
  }),
);
