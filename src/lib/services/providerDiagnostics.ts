import {ProviderExtension, ProviderModule} from '../storage/extensionStorage';
import {extensionManager} from './ExtensionManager';
import {
  runProviderCatalog,
  runProviderEpisodes,
  runProviderMeta,
  runProviderPosts,
  runProviderStream,
} from '../sandbox/sandboxRuntime';

export type DiagnosticStageName =
  | 'Catalog'
  | 'Show list (posts)'
  | 'Metadata'
  | 'Playback (episodes/directLinks)'
  | 'Streams';

export type DiagnosticStageStatus = 'running' | 'pass' | 'fail';

export interface DiagnosticProgressEvent {
  stageIndex: number;
  totalStages: number;
  stageName: DiagnosticStageName;
  status: DiagnosticStageStatus;
  detail?: string;
}

export interface ProviderDiagnosticResult {
  passed: boolean;
  failedStage?: DiagnosticStageName;
  reason?: string;
  stagesCompleted: DiagnosticStageName[];
  cancelled?: boolean;
}

const TOTAL_STAGES = 5;

const cleanReason = (err: unknown): string => {
  const raw = err instanceof Error ? err.message : String(err || '');
  const trimmed = raw.trim();
  if (!trimmed) {
    return 'Unknown error';
  }
  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed;
};

export async function testProvider(
  provider: ProviderExtension,
  onProgress?: (event: DiagnosticProgressEvent) => void,
): Promise<ProviderDiagnosticResult> {
  const signal = extensionManager.beginDiagnosticTest();
  const stagesCompleted: DiagnosticStageName[] = [];
  const sourceAuthor = provider.source?.author;

  const emit = (
    stageIndex: number,
    stageName: DiagnosticStageName,
    status: DiagnosticStageStatus,
    detail?: string,
  ) => {
    try {
      onProgress?.({
        stageIndex,
        totalStages: TOTAL_STAGES,
        stageName,
        status,
        detail,
      });
    } catch {
      // Ignore UI callback errors
    }
  };

  try {
    let moduleData: ProviderModule | undefined =
      extensionManager.getProviderModules(provider.value, sourceAuthor);

    const hasAllCoreModules = Boolean(
      moduleData?.modules.catalog &&
        moduleData?.modules.posts &&
        moduleData?.modules.meta &&
        moduleData?.modules.stream,
    );

    if (!hasAllCoreModules) {
      try {
        moduleData = await extensionManager.downloadProviderModules(
          provider,
          signal,
        );
      } catch (err) {
        if (signal.aborted) {
          return {passed: false, stagesCompleted, cancelled: true};
        }
        return {
          passed: false,
          failedStage: 'Catalog',
          reason: `Failed to download provider modules: ${cleanReason(err)}`,
          stagesCompleted,
        };
      }
    }

    if (signal.aborted) {
      return {passed: false, stagesCompleted, cancelled: true};
    }

    // Stage 1: Catalog
    emit(1, 'Catalog', 'running');
    let firstFilter = '';
    try {
      const {catalog} = await runProviderCatalog(
        moduleData!.modules.catalog!,
        provider.value,
        sourceAuthor,
      );
      if (!Array.isArray(catalog) || catalog.length === 0) {
        emit(1, 'Catalog', 'fail', 'Catalog returned empty list');
        return {
          passed: false,
          failedStage: 'Catalog',
          reason: 'Catalog returned empty list',
          stagesCompleted,
        };
      }
      firstFilter = catalog[0].filter ?? '';
      stagesCompleted.push('Catalog');
      emit(1, 'Catalog', 'pass', `${catalog.length} categories`);
    } catch (err) {
      if (signal.aborted) {
        return {passed: false, stagesCompleted, cancelled: true};
      }
      const reason = cleanReason(err);
      emit(1, 'Catalog', 'fail', reason);
      return {
        passed: false,
        failedStage: 'Catalog',
        reason,
        stagesCompleted,
      };
    }

    // Stage 2: Show list (posts)
    emit(2, 'Show list (posts)', 'running');
    let firstPostLink = '';
    try {
      const posts = await runProviderPosts(moduleData!.modules.posts!, {
        filter: firstFilter,
        page: 1,
        providerValue: provider.value,
        signal,
        sourceAuthor,
      });
      if (!Array.isArray(posts) || posts.length === 0 || !posts[0]?.link) {
        emit(2, 'Show list (posts)', 'fail', 'No posts returned');
        return {
          passed: false,
          failedStage: 'Show list (posts)',
          reason: 'getPosts returned no items',
          stagesCompleted,
        };
      }
      firstPostLink = posts[0].link;
      stagesCompleted.push('Show list (posts)');
      emit(2, 'Show list (posts)', 'pass', `${posts.length} posts`);
    } catch (err) {
      if (signal.aborted) {
        return {passed: false, stagesCompleted, cancelled: true};
      }
      const reason = cleanReason(err);
      emit(2, 'Show list (posts)', 'fail', reason);
      return {
        passed: false,
        failedStage: 'Show list (posts)',
        reason,
        stagesCompleted,
      };
    }

    // Stage 3: Metadata
    emit(3, 'Metadata', 'running');
    let metaInfo: Awaited<ReturnType<typeof runProviderMeta>>;
    try {
      metaInfo = await runProviderMeta(moduleData!.modules.meta!, {
        link: firstPostLink,
        provider: provider.value,
        signal,
        sourceAuthor,
      });
      if (
        !metaInfo ||
        !Array.isArray(metaInfo.linkList) ||
        metaInfo.linkList.length === 0
      ) {
        emit(3, 'Metadata', 'fail', 'Metadata linkList is empty');
        return {
          passed: false,
          failedStage: 'Metadata',
          reason: 'getMeta returned empty linkList',
          stagesCompleted,
        };
      }
      stagesCompleted.push('Metadata');
      emit(3, 'Metadata', 'pass', metaInfo.title || 'Loaded');
    } catch (err) {
      if (signal.aborted) {
        return {passed: false, stagesCompleted, cancelled: true};
      }
      const reason = cleanReason(err);
      emit(3, 'Metadata', 'fail', reason);
      return {
        passed: false,
        failedStage: 'Metadata',
        reason,
        stagesCompleted,
      };
    }

    // Stage 4: Playback (episodes/directLinks)
    emit(4, 'Playback (episodes/directLinks)', 'running');
    let streamTargetLink = '';
    let streamTargetType = metaInfo.type || 'movie';
    try {
      const firstGroup = metaInfo.linkList[0];
      if (
        Array.isArray(firstGroup.directLinks) &&
        firstGroup.directLinks.length > 0 &&
        firstGroup.directLinks[0]?.link
      ) {
        streamTargetLink = firstGroup.directLinks[0].link;
        streamTargetType =
          firstGroup.directLinks[0].type || metaInfo.type || 'movie';
      } else if (firstGroup.episodesLink && moduleData!.modules.episodes) {
        const episodes = await runProviderEpisodes(
          moduleData!.modules.episodes,
          {
            url: firstGroup.episodesLink,
            providerValue: provider.value,
            signal,
            sourceAuthor,
          },
        );
        if (!Array.isArray(episodes) || !episodes[0]?.link) {
          emit(
            4,
            'Playback (episodes/directLinks)',
            'fail',
            'getEpisodes returned no episodes',
          );
          return {
            passed: false,
            failedStage: 'Playback (episodes/directLinks)',
            reason: 'getEpisodes returned no episodes',
            stagesCompleted,
          };
        }
        streamTargetLink = episodes[0].link;
        streamTargetType = 'series';
      } else if (firstGroup.episodesLink) {
        streamTargetLink = firstGroup.episodesLink;
      }

      if (!streamTargetLink) {
        emit(
          4,
          'Playback (episodes/directLinks)',
          'fail',
          'No playable episode or direct link found',
        );
        return {
          passed: false,
          failedStage: 'Playback (episodes/directLinks)',
          reason: 'No playable episode or direct link found',
          stagesCompleted,
        };
      }
      stagesCompleted.push('Playback (episodes/directLinks)');
      emit(4, 'Playback (episodes/directLinks)', 'pass', 'Playable link found');
    } catch (err) {
      if (signal.aborted) {
        return {passed: false, stagesCompleted, cancelled: true};
      }
      const reason = cleanReason(err);
      emit(4, 'Playback (episodes/directLinks)', 'fail', reason);
      return {
        passed: false,
        failedStage: 'Playback (episodes/directLinks)',
        reason,
        stagesCompleted,
      };
    }

    // Stage 5: Streams
    emit(5, 'Streams', 'running');
    try {
      const streams = await runProviderStream(moduleData!.modules.stream!, {
        link: streamTargetLink,
        type: streamTargetType,
        providerValue: provider.value,
        isDownload: false,
        signal,
        sourceAuthor,
      });
      if (!Array.isArray(streams) || streams.length === 0 || !streams[0]?.link) {
        emit(5, 'Streams', 'fail', 'getStream returned no playable streams');
        return {
          passed: false,
          failedStage: 'Streams',
          reason: 'getStream returned no playable streams',
          stagesCompleted,
        };
      }
      stagesCompleted.push('Streams');
      emit(5, 'Streams', 'pass', `${streams.length} stream(s) resolved`);
      return {
        passed: true,
        stagesCompleted,
      };
    } catch (err) {
      if (signal.aborted) {
        return {passed: false, stagesCompleted, cancelled: true};
      }
      const reason = cleanReason(err);
      emit(5, 'Streams', 'fail', reason);
      return {
        passed: false,
        failedStage: 'Streams',
        reason,
        stagesCompleted,
      };
    }
  } finally {
    extensionManager.endDiagnosticTest();
  }
}
