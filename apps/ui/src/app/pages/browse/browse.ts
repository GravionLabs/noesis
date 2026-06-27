import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HelixEmpty } from '@gravionlabs/helix';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Select } from 'primeng/select';
import type { DocChunk, SourceDoc } from '../../core/models/doc.model';
import type { Source } from '../../core/models/source.model';
import { NoesisApiService } from '../../core/services/noesis-api.service';
import { SourcesStore } from '../../core/stores/sources.store';

@Component({
  selector: 'app-browse',
  standalone: true,
  imports: [FormsModule, HelixEmpty, Button, Card, ProgressSpinner, Select],
  templateUrl: './browse.html',
})
export class Browse {
  private readonly api = inject(NoesisApiService);
  protected readonly sourcesStore = inject(SourcesStore);

  protected readonly sourceOptions = computed(() =>
    this.sourcesStore.sources().map((s) => ({ label: s.name, value: s })),
  );

  protected readonly selectedSource = signal<Source | undefined>(undefined);
  protected readonly docs = signal<SourceDoc[]>([]);
  protected readonly loadingDocs = signal(false);
  protected readonly docsError = signal<string | null>(null);

  protected readonly selectedDoc = signal<SourceDoc | undefined>(undefined);
  protected readonly chunks = signal<DocChunk[]>([]);
  protected readonly loadingChunks = signal(false);
  protected readonly chunksError = signal<string | null>(null);

  protected readonly expandedChunk = signal<string | undefined>(undefined);

  constructor() {
    this.sourcesStore.loadSources();
  }

  protected onSourceChange(source: Source | undefined): void {
    this.selectedSource.set(source);
    this.docs.set([]);
    this.selectedDoc.set(undefined);
    this.chunks.set([]);
    this.chunksError.set(null);

    if (!source) return;

    this.loadingDocs.set(true);
    this.docsError.set(null);
    this.api.getSourceDocs(source.id).subscribe({
      next: (docs) => {
        this.docs.set(docs);
        this.loadingDocs.set(false);
      },
      error: (err: Error) => {
        this.docsError.set(err.message);
        this.loadingDocs.set(false);
      },
    });
  }

  protected onDocSelect(doc: SourceDoc): void {
    this.selectedDoc.set(doc);
    this.chunks.set([]);
    this.chunksError.set(null);

    this.loadingChunks.set(true);
    this.api.getDocChunks(doc.id).subscribe({
      next: (chunks) => {
        this.chunks.set(chunks);
        this.loadingChunks.set(false);
      },
      error: (err: Error) => {
        this.chunksError.set(err.message);
        this.loadingChunks.set(false);
      },
    });
  }

  protected toggleChunk(chunkId: string): void {
    this.expandedChunk.set(
      this.expandedChunk() === chunkId ? undefined : chunkId,
    );
  }
}
