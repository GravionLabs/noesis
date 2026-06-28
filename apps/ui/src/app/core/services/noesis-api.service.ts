import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { Source, SourceStats, CreateSourceDto, UpdateSourceDto } from '../models/source.model';
import type { Job } from '../models/job.model';
import type { JobLogEntry } from '../models/job.model';
import type { SearchResult, SearchParams } from '../models/search.model';
import type { ChunkDetail } from '../models/chunk.model';
import type { SourceDoc, DocChunk } from '../models/doc.model';
import type { AggregateStats, HealthInfo } from '../models/stats.model';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class NoesisApiService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);

  private api(path: string): string {
    const base = this.settings.baseUrl().replace(/\/+$/, '');
    return base ? `${base}${path}` : path;
  }

  listSources(): Observable<Source[]> {
    return this.http.get<Source[]>(this.api('/api/sources'));
  }

  getSource(id: string): Observable<Source> {
    return this.http.get<Source>(this.api(`/api/sources/${id}`));
  }

  createSource(dto: CreateSourceDto): Observable<Source> {
    return this.http.post<Source>(this.api('/api/sources'), dto);
  }

  updateSource(id: string, dto: UpdateSourceDto): Observable<Source> {
    return this.http.patch<Source>(this.api(`/api/sources/${id}`), dto);
  }

  deleteSource(id: string): Observable<void> {
    return this.http.delete<void>(this.api(`/api/sources/${id}`));
  }

  getSourceStats(id: string): Observable<SourceStats> {
    return this.http.get<SourceStats>(this.api(`/api/sources/${id}/stats`));
  }

  triggerImport(id: string): Observable<{ jobId: string; status: string }> {
    return this.http.post<{ jobId: string; status: string }>(
      this.api(`/api/sources/${id}/import`),
      {},
    );
  }

  listJobs(): Observable<Job[]> {
    return this.http.get<Job[]>(this.api('/api/jobs'));
  }

  getJob(id: string): Observable<Job> {
    return this.http.get<Job>(this.api(`/api/jobs/${id}`));
  }

  retryJob(id: string): Observable<{ jobId: string; status: string }> {
    return this.http.post<{ jobId: string; status: string }>(
      this.api(`/api/jobs/${id}/retry`),
      {},
    );
  }

  deleteJob(id: string): Observable<void> {
    return this.http.delete<void>(this.api(`/api/jobs/${id}`));
  }

  cancelJob(id: string): Observable<{ jobId: string; status: string }> {
    return this.http.post<{ jobId: string; status: string }>(
      this.api(`/api/jobs/${id}/cancel`),
      {},
    );
  }

  getJobLogs(id: string): Observable<JobLogEntry[]> {
    return this.http.get<JobLogEntry[]>(this.api(`/api/jobs/${id}/logs`));
  }

  search(params: SearchParams): Observable<SearchResult[]> {
    const query = new URLSearchParams({ q: params.q });
    if (params.source) query.set('source', params.source);
    if (params.limit) query.set('limit', String(params.limit));
    return this.http.get<SearchResult[]>(this.api(`/api/search?${query}`));
  }

  getStats(): Observable<AggregateStats> {
    return this.http.get<AggregateStats>(this.api('/api/stats'));
  }

  getHealth(): Observable<HealthInfo> {
    return this.http.get<HealthInfo>(this.api('/healthz/ready'));
  }

  getSourceDocs(id: string): Observable<SourceDoc[]> {
    return this.http.get<SourceDoc[]>(this.api(`/api/sources/${id}/docs`));
  }

  getDocChunks(id: string): Observable<DocChunk[]> {
    return this.http.get<DocChunk[]>(this.api(`/api/docs/${id}/chunks`));
  }

  getChunk(id: string): Observable<ChunkDetail> {
    return this.http.get<ChunkDetail>(this.api(`/api/chunks/${id}`));
  }

  /** Returns the fully-qualified URL for the SSE job stream (respects baseUrl). */
  getJobStreamUrl(): string {
    return this.api('/api/jobs/stream');
  }
}
