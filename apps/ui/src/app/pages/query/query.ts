import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HelixBadge, HelixEmpty } from '@gravionlabs/helix';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { Message } from 'primeng/message';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import type { ChunkDetail } from '../../core/models/chunk.model';
import type { SearchResult } from '../../core/models/search.model';
import { NoesisApiService } from '../../core/services/noesis-api.service';
import { SourcesStore } from '../../core/stores/sources.store';

const PREVIEW_LENGTH = 400;

@Component({
  selector: 'app-query',
  standalone: true,
  imports: [
    FormsModule,
    HelixBadge,
    HelixEmpty,
    Button,
    Card,
    Dialog,
    InputNumber,
    Message,
    ProgressSpinner,
    Select,
    Textarea,
  ],
  templateUrl: './query.html',
})
export class Query {
  private readonly api = inject(NoesisApiService);
  private readonly messageService = inject(MessageService);
  protected readonly sourcesStore = inject(SourcesStore);

  protected readonly sourceOptions = computed(() => [
    { label: 'All Sources', value: undefined },
    ...this.sourcesStore.sources().map((s) => ({ label: s.name, value: s.name })),
  ]);

  protected readonly queryText = signal('');
  protected readonly sourceFilter = signal<string | undefined>(undefined);
  protected readonly limit = signal(10);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly results = signal<SearchResult[]>([]);
  protected readonly hasSearched = signal(false);
  protected readonly expanded = signal<Set<string>>(new Set());

  protected readonly loadingFullChunk = signal(false);
  protected readonly fullChunk = signal<ChunkDetail | undefined>(undefined);

  constructor() {
    this.sourcesStore.loadSources();
  }

  protected search(): void {
    const q = this.queryText().trim();
    if (!q) return;

    this.loading.set(true);
    this.error.set(null);
    this.api.search({ q, source: this.sourceFilter(), limit: this.limit() }).subscribe({
      next: (results) => {
        this.results.set(results);
        this.hasSearched.set(true);
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.loading.set(false);
        this.hasSearched.set(true);
      },
    });
  }

  protected isExpanded(result: SearchResult): boolean {
    return this.expanded().has(result.chunkId);
  }

  protected toggleExpanded(result: SearchResult): void {
    const next = new Set(this.expanded());
    if (next.has(result.chunkId)) {
      next.delete(result.chunkId);
    } else {
      next.add(result.chunkId);
    }
    this.expanded.set(next);
  }

  protected preview(content: string): string {
    return content.length > PREVIEW_LENGTH ? `${content.slice(0, PREVIEW_LENGTH)}...` : content;
  }

  protected needsTruncation(content: string): boolean {
    return content.length > PREVIEW_LENGTH;
  }

  protected scorePercent(score: number): number {
    return Math.round(score * 100);
  }

  protected viewFullChunk(result: SearchResult): void {
    this.loadingFullChunk.set(true);
    this.api.getChunk(result.chunkId).subscribe({
      next: (detail) => {
        this.fullChunk.set(detail);
        this.loadingFullChunk.set(false);
      },
      error: () => {
        this.loadingFullChunk.set(false);
      },
    });
  }

  protected closeFullChunk(): void {
    this.fullChunk.set(undefined);
  }

  protected copyFullChunk(): void {
    const chunk = this.fullChunk();
    if (chunk) this.copyChunk(chunk.content);
  }

  protected copyChunk(content: string): void {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(content).then(
        () => this.onCopySuccess(),
        () => this.copyFallback(content),
      );
    } else {
      this.copyFallback(content);
    }
  }

  private copyFallback(content: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      this.onCopySuccess();
    } finally {
      document.body.removeChild(textarea);
    }
  }

  private onCopySuccess(): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Copied!',
      detail: 'Chunk copied to clipboard',
    });
  }
}
