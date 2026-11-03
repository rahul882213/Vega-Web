import {ProviderExtension, ProviderModule} from '../storage/extensionStorage';
import {extensionManager} from './ExtensionManager';
import {
  runProviderCatalog,
  runProviderEpisodes,
  runProviderMeta,
  runProviderPosts,
  runProviderStream,
  setSandboxDiagnosticTestMode,
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
  setSandboxDiagnosticTestMode(true);
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
    let candidatePosts: Array<{title: string; link: string}> = [];
    try {
      const posts = await runProviderPosts(moduleData!.modules.posts!, {
        filter: firstFilter,
        page: 1,
        providerValue: provider.value,
        signal,
        sourceAuthor,
      });
      const validPosts = Array.isArray(posts)
        ? posts.filter(p => p && typeof p.link === 'string' && p.link.trim())
        : [];
      if (validPosts.length === 0) {
        emit(2, 'Show list (posts)', 'fail', 'No posts returned');
        return {
          passed: false,
          failedStage: 'Show list (posts)',
          reason: 'getPosts returned no items',
          stagesCompleted,
        };
      }
      candidatePosts = validPosts.slice(0, 5);
      stagesCompleted.push('Show list (posts)');
      emit(2, 'Show list (posts)', 'pass', `${validPosts.length} posts`);
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

    // Stage 3: Metadata (try up to 5 candidate posts in case the first post is a pinned banner/notice)
    emit(3, 'Metadata', 'running');
    let metaInfo: Awaited<ReturnType<typeof runProviderMeta>> | undefined;
    let lastMetaError: unknown = null;
    try {
      for (const post of candidatePosts) {
        if (signal.aborted) {
          return {passed: false, stagesCompleted, cancelled: true};
        }
        try {
          const candidateMeta = await runProviderMeta(
            moduleData!.modules.meta!,
            {
              link: post.link,
              provider: provider.value,
              signal,
              sourceAuthor,
            },
          );
          if (
            candidateMeta &&
            Array.isArray(candidateMeta.linkList) &&
            candidateMeta.linkList.length > 0
          ) {
            metaInfo = candidateMeta;
            break;
          }
        } catch (innerErr) {
          lastMetaError = innerErr;
        }
      }

      if (
        !metaInfo ||
        !Array.isArray(metaInfo.linkList) ||
        metaInfo.linkList.length === 0
      ) {
        if (lastMetaError) {
          throw lastMetaError;
        }
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
    const streamTargets: Array<{link: string; type: string}> = [];
    let lastPlaybackError: unknown = null;
    try {
      for (const group of metaInfo.linkList.slice(0, 4)) {
        if (signal.aborted) {
          return {passed: false, stagesCompleted, cancelled: true};
        }
        if (Array.isArray(group.directLinks) && group.directLinks.length > 0) {
          for (const dl of group.directLinks) {
            if (dl?.link) {
              streamTargets.push({
                link: dl.link,
                type: dl.type || metaInfo.type || 'movie',
              });
            }
          }
        } else if (group.episodesLink && moduleData!.modules.episodes) {
          try {
            const episodes = await runProviderEpisodes(
              moduleData!.modules.episodes,
              {
                url: group.episodesLink,
                providerValue: provider.value,
                signal,
                sourceAuthor,
              },
            );
            if (Array.isArray(episodes)) {
              for (const ep of episodes.slice(0, 3)) {
                if (ep?.link) {
                  streamTargets.push({link: ep.link, type: 'series'});
                }
              }
            }
          } catch (epErr) {
            lastPlaybackError = epErr;
          }
        } else if (group.episodesLink) {
          streamTargets.push({
            link: group.episodesLink,
            type: metaInfo.type || 'movie',
          });
        }
        if (streamTargets.length >= 3) break;
      }

      if (streamTargets.length === 0) {
        if (lastPlaybackError) {
          throw lastPlaybackError;
        }
        const failMsg = moduleData!.modules.episodes
          ? 'getEpisodes returned no episodes'
          : 'No playable episode or direct link found';
        emit(4, 'Playback (episodes/directLinks)', 'fail', failMsg);
        return {
          passed: false,
          failedStage: 'Playback (episodes/directLinks)',
          reason: failMsg,
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
    let resolvedStreamsCount = 0;
    let lastStreamError: unknown = null;
    try {
      for (const target of streamTargets.slice(0, 3)) {
        if (signal.aborted) {
          return {passed: false, stagesCompleted, cancelled: true};
        }
        try {
          const streams = await runProviderStream(moduleData!.modules.stream!, {
            link: target.link,
            type: target.type,
            providerValue: provider.value,
            isDownload: false,
            signal,
            sourceAuthor,
          });
          if (Array.isArray(streams) && streams.length > 0 && streams[0]?.link) {
            resolvedStreamsCount = streams.length;
            break;
          }
        } catch (streamErr) {
          lastStreamError = streamErr;
        }
      }

      if (resolvedStreamsCount === 0) {
        if (lastStreamError) {
          throw lastStreamError;
        }
        emit(5, 'Streams', 'fail', 'getStream returned no playable streams');
        return {
          passed: false,
          failedStage: 'Streams',
          reason: 'getStream returned no playable streams',
          stagesCompleted,
        };
      }
      stagesCompleted.push('Streams');
      emit(5, 'Streams', 'pass', `${resolvedStreamsCount} stream(s) resolved`);
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
    setSandboxDiagnosticTestMode(false);
    extensionManager.endDiagnosticTest();
  }
}
