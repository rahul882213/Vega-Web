import React, {useState, useEffect, useRef, useMemo, useCallback} from 'react';
import Hls from 'hls.js';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Subtitles,
  AudioWaveform,
  Gauge,
  SkipForward,
  Lock,
  Unlock,
  ListVideo,
  AlertTriangle,
  RefreshCw,
  Check,
  X,
  Plus,
  Minus,
  Maximize2,
  Moon,
  Cpu,
  PictureInPicture2,
  Server,
  ExternalLink,
  Copy,
  Download,
  FolderOpen,
  Clock,
} from 'lucide-react';
import {useM3Colors} from '../theme/M3PaletteContext';
import {useVegaNavigation, PlayerRouteParams} from '../NavigationContext';
import useContentStore from '../lib/zustand/contentStore';
import useContinueWatchingStore from '../lib/zustand/continueWatchingStore';
import {useStream} from '../lib/hooks/useStream';
import {
  settingsStorage,
  cacheStorage,
  PLAYBACK_SPEEDS,
  PLAYER_RESIZE_MODES,
  PlayerResizeMode,
} from '../lib/storage';
import {EpisodeLink, Stream} from '../lib/providers/types';
import {QualityOption} from '../components/PlayerSourceMenu';

interface AudioTrackItem {
  id: number;
  label: string;
  detail?: string;
  language?: string;
  source: 'hls' | 'probed';
}

interface SubtitleTrackItem {
  id: string;
  title: string;
  detail?: string;
  language: string;
  uri: string;
}

type DecoderMode = 'hw' | 'sw' | 'direct';
type SettingsTab = 'audio' | 'subtitle' | 'speed' | 'server' | 'sleep' | 'external';
type SleepOption = 'off' | 'episode' | number;

const SLEEP_PRESETS: SleepOption[] = ['off', 15, 30, 45, 60, 90, 'episode'];

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  eng: 'English',
  hi: 'Hindi',
  hin: 'Hindi',
  ta: 'Tamil',
  tam: 'Tamil',
  te: 'Telugu',
  tel: 'Telugu',
  ml: 'Malayalam',
  mal: 'Malayalam',
  kn: 'Kannada',
  kan: 'Kannada',
  ja: 'Japanese',
  jpn: 'Japanese',
  ko: 'Korean',
  kor: 'Korean',
  es: 'Spanish',
  spa: 'Spanish',
  fr: 'French',
  fre: 'French',
  de: 'German',
  ger: 'German',
  ru: 'Russian',
  rus: 'Russian',
  pt: 'Portuguese',
  por: 'Portuguese',
  it: 'Italian',
  ita: 'Italian',
  zh: 'Chinese',
  chi: 'Chinese',
  und: 'Default Audio',
};

function formatLang(code?: string, fallback = 'Unknown'): string {
  if (!code) return fallback;
  const clean = code.toLowerCase().trim();
  return LANGUAGE_NAMES[clean] || code.toUpperCase();
}

function convertSrtToVtt(srtText: string): string {
  const cleaned = srtText
    .replace(/\r+/g, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${cleaned}`;
}

function formatTime(sec: number, showHoursForce = false): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const total = Math.floor(sec);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hrs > 0 || showHoursForce
    ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
    : `${pad(mins)}:${pad(secs)}`;
}

export const Player: React.FC<{routeParams: PlayerRouteParams}> = ({
  routeParams,
}) => {
  const colors = useM3Colors();
  const {goBack} = useVegaNavigation();
  const {provider} = useContentStore();
  const {updateProgress, finishEpisode} = useContinueWatchingStore();

  const [episodeIndex, setEpisodeIndex] = useState<number>(
    routeParams.episodeIndex || 0,
  );
  const activeEpisode: EpisodeLink | null =
    routeParams.linkList?.[episodeIndex] || routeParams.linkList?.[0] || null;

  const {
    stream: streams,
    selectedStream,
    setSelectedStream,
    externalSubs,
    setExternalSubs,
    isLoading: streamLoading,
    error: streamError,
    refetch: refetchStreams,
    switchToNextStream,
  } = useStream({
    activeEpisode,
    routeParams,
    provider: routeParams.providerValue || provider.value,
    enabled: Boolean(activeEpisode?.link),
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekTrackRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const subFileInputRef = useRef<HTMLInputElement>(null);
  const localVideoInputRef = useRef<HTMLInputElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [rawVideoTime, setRawVideoTime] = useState(0);
  const [rawVideoDuration, setRawVideoDuration] = useState(0);
  const [probedDuration, setProbedDuration] = useState(0);
  const [transcodeOffset, setTranscodeOffset] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);

  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showUnlockPill, setShowUnlockPill] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showTimeRemaining, setShowTimeRemaining] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Decoder & Transcode state
  const [decoderMode, setDecoderMode] = useState<DecoderMode>('hw');
  const [transcodeAvailable, setTranscodeAvailable] = useState<boolean | null>(
    null,
  );
  const [useRawUrlFallback, setUseRawUrlFallback] = useState(false);
  const [probedAudioTracks, setProbedAudioTracks] = useState<AudioTrackItem[]>([]);
  const [probedSubTracks, setProbedSubTracks] = useState<SubtitleTrackItem[]>([]);
  const [probedResolution, setProbedResolution] = useState<string>('');

  // Scrubbing preview state
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverLeftPx, setHoverLeftPx] = useState<number>(0);
  const [skipFeedback, setSkipFeedback] = useState<{
    side: 'left' | 'right';
    seconds: number;
  } | null>(null);

  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() =>
    settingsStorage.getPlaybackSpeed(),
  );
  const [resizeMode, setResizeMode] = useState<PlayerResizeMode>(() =>
    settingsStorage.getDefaultResizeMode(),
  );

  // Audio & Subtitle Delay (ms)
  const [audioDelayMs, setAudioDelayMs] = useState(0);
  const [subtitleDelayMs, setSubtitleDelayMs] = useState(0);

  // Unified Vega Settings Sheet & Episode Drawer
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('server');
  const [episodeDrawerOpen, setEpisodeDrawerOpen] = useState(false);

  // Sleep Timer
  const [sleepOption, setSleepOption] = useState<SleepOption>('off');
  const [sleepMinutesLeft, setSleepMinutesLeft] = useState<number | null>(null);

  // HLS Quality & Audio Tracks
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([
    {id: -1, label: 'Auto', detail: 'Adaptive bitrate'},
  ]);
  const [selectedQualityId, setSelectedQualityId] = useState<number>(-1);
  const [hlsAudioTracks, setHlsAudioTracks] = useState<AudioTrackItem[]>([]);
  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<number>(0);

  // Subtitles
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string>('off');
  const [activeVttBlobUrl, setActiveVttBlobUrl] = useState<string | null>(null);

  const seekInterval = settingsStorage.getSeekInterval();
  const hideSeekButtons = settingsStorage.hideSeekButtons();
  const showEpisodeSidebarBtn = settingsStorage.showPlayerEpisodeSidebar();
  const showSleepTimerBtn = settingsStorage.showSleepTimer();

  const showToast = useCallback((msg: string, durationMs = 2200) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, durationMs);
  }, []);

  const encodedStreamHeaders = useMemo(() => {
    const hasCustomHeaders =
      selectedStream?.headers &&
      typeof selectedStream.headers === 'object' &&
      Object.keys(selectedStream.headers).length > 0;
    return hasCustomHeaders
      ? window.btoa(JSON.stringify(selectedStream.headers))
      : '';
  }, [selectedStream?.headers]);

  const isHlsStream = useMemo(() => {
    const rawLink = selectedStream?.link?.toLowerCase() || '';
    return (
      selectedStream?.type?.toLowerCase() === 'm3u8' ||
      rawLink.includes('.m3u8')
    );
  }, [selectedStream]);

  const isLocalBlob = useMemo(() => {
    return Boolean(selectedStream?.link?.startsWith('blob:'));
  }, [selectedStream?.link]);

  const isUsingTranscodeEngine = useMemo(() => {
    if (
      isLocalBlob ||
      isHlsStream ||
      !selectedStream?.link ||
      transcodeAvailable === false
    ) {
      return false;
    }
    return decoderMode === 'hw' || decoderMode === 'sw';
  }, [
    isLocalBlob,
    isHlsStream,
    selectedStream?.link,
    decoderMode,
    transcodeAvailable,
  ]);

  const currentTime = isUsingTranscodeEngine
    ? transcodeOffset + rawVideoTime
    : rawVideoTime;

  const duration = useMemo(() => {
    if (probedDuration > 0) return probedDuration;
    if (
      Number.isFinite(rawVideoDuration) &&
      rawVideoDuration > 0 &&
      rawVideoDuration < 86400
    ) {
      return isUsingTranscodeEngine
        ? Math.max(probedDuration, transcodeOffset + rawVideoDuration)
        : rawVideoDuration;
    }
    return 0;
  }, [probedDuration, rawVideoDuration, isUsingTranscodeEngine, transcodeOffset]);

  // Reset per-stream state and probe stream metadata via ffprobe
  useEffect(() => {
    const rawLink = selectedStream?.link?.trim() || '';
    setPlaybackError(null);
    setRawVideoTime(0);
    setRawVideoDuration(0);
    setProbedDuration(0);
    setProbedAudioTracks([]);
    setProbedSubTracks([]);
    setProbedResolution('');
    setSelectedAudioTrackId(0);
    setUseRawUrlFallback(false);

    // Check saved resume position
    const savedResumePos =
      activeEpisode?.link
        ? cacheStorage.getObject<number>(`resume_${activeEpisode.link}`) || 0
        : 0;

    const isMkvOrContainer =
      selectedStream?.type?.toLowerCase() === 'mkv' ||
      rawLink.toLowerCase().includes('.mkv') ||
      rawLink.toLowerCase().includes('cloudflarestorage') ||
      rawLink.toLowerCase().includes('pixeldrain') ||
      rawLink.toLowerCase().includes('gofile') ||
      rawLink.toLowerCase().includes('hubcdn') ||
      rawLink.toLowerCase().includes('workers.dev');

    const initialMode: DecoderMode =
      transcodeAvailable === false
        ? 'direct'
        : isMkvOrContainer
          ? 'hw'
          : 'direct';
    setDecoderMode(initialMode);
    setTranscodeOffset(
      initialMode !== 'direct' && savedResumePos > 5
        ? Math.floor(savedResumePos)
        : 0,
    );

    if (!rawLink || rawLink.startsWith('blob:')) return;

    let cancelled = false;
    const params = new URLSearchParams({url: rawLink});
    if (encodedStreamHeaders) {
      params.set('headers', encodedStreamHeaders);
    }

    fetch(`/api/probe-stream?${params.toString()}`)
      .then(async r => {
        const ct = (r.headers.get('content-type') || '').toLowerCase();
        if (!r.ok || !ct.includes('application/json')) {
          throw new Error('Probe endpoint unavailable');
        }
        return r.json();
      })
      .then(info => {
        if (cancelled || !info) return;
        setTranscodeAvailable(true);
        if (typeof info.duration === 'number' && info.duration > 0) {
          setProbedDuration(info.duration);
        }
        if (info.height > 0) {
          setProbedResolution(`${info.height}p`);
        }
        if (Array.isArray(info.audioTracks) && info.audioTracks.length > 0) {
          setProbedAudioTracks(
            info.audioTracks.map((a: any, idx: number) => ({
              id: idx,
              label: formatLang(a.language, `Audio ${idx + 1}`),
              detail: [
                a.codec?.toUpperCase(),
                a.channels ? `${a.channels}ch` : null,
                a.title,
              ]
                .filter(Boolean)
                .join(' · '),
              language: a.language,
              source: 'probed' as const,
            })),
          );
        }
        if (Array.isArray(info.subtitleTracks) && info.subtitleTracks.length > 0) {
          setProbedSubTracks(
            info.subtitleTracks.map((s: any, idx: number) => {
              const subParams = new URLSearchParams({
                url: rawLink,
                track: String(idx),
              });
              if (encodedStreamHeaders) {
                subParams.set('headers', encodedStreamHeaders);
              }
              return {
                id: `embedded-${idx}`,
                title: formatLang(s.language, `Subtitle ${idx + 1}`),
                detail: [s.codec?.toUpperCase(), s.title, 'Embedded']
                  .filter(Boolean)
                  .join(' · '),
                language: s.language || 'en',
                uri: `/api/subtitle-extract?${subParams.toString()}`,
              };
            }),
          );
        }
        // If probe reveals HEVC / EAC3 / AC3 while in 'direct' mode, switch to 'hw' automatically
        const hasIncompatibleAudio =
          Array.isArray(info.audioTracks) &&
          info.audioTracks.some((a: any) =>
            /eac3|ac3|dts|truehd|flac/i.test(String(a.codec || '')),
          );
        const isHevc = /hevc|h265|vp9|av1/i.test(String(info.videoCodec || ''));
        if (hasIncompatibleAudio || isHevc) {
          setDecoderMode(prev => (prev === 'direct' ? (isHevc ? 'sw' : 'hw') : prev));
        }
      })
      .catch(() => {
        if (cancelled) return;
        setTranscodeAvailable(false);
        setDecoderMode('direct');
        setTranscodeOffset(0);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStream?.link, selectedStream?.server, encodedStreamHeaders]);

  const audioTracks = useMemo<AudioTrackItem[]>(() => {
    if (hlsAudioTracks.length > 0) return hlsAudioTracks;
    return probedAudioTracks;
  }, [hlsAudioTracks, probedAudioTracks]);

  const subtitleTracks = useMemo<SubtitleTrackItem[]>(() => {
    const ext = (externalSubs || []).map((sub, idx) => ({
      id: `ext-${idx}`,
      title: formatLang(sub.language, sub.title || `Subtitle ${idx + 1}`),
      detail: sub.title || 'External',
      language: sub.language || 'en',
      uri: sub.uri,
    }));
    return [...probedSubTracks, ...ext];
  }, [probedSubTracks, externalSubs]);

  // Build resolved playback URL
  const resolvedVideoUrl = useMemo(() => {
    const rawLink = selectedStream?.link?.trim() || '';
    if (!rawLink) return '';
    if (rawLink.startsWith('blob:') || rawLink.startsWith('/api/')) {
      return rawLink;
    }

    if (useRawUrlFallback) {
      return rawLink;
    }

    // On serverless/static hosts (transcodeAvailable === false), stream large MP4/MKV containers directly from CDN
    if (
      transcodeAvailable === false &&
      !isHlsStream &&
      !encodedStreamHeaders
    ) {
      return rawLink;
    }

    if (
      isHlsStream ||
      decoderMode === 'direct' ||
      transcodeAvailable === false
    ) {
      const params = new URLSearchParams({url: rawLink});
      if (encodedStreamHeaders) {
        params.set('headers', encodedStreamHeaders);
      }
      return `/api/stream-proxy?${params.toString()}`;
    }

    // Live FFmpeg Remux ('hw') or Software Transcode ('sw')
    const params = new URLSearchParams({
      url: rawLink,
      start: String(Math.floor(transcodeOffset)),
      audio: String(selectedAudioTrackId),
      mode: decoderMode === 'sw' ? 'sw' : 'auto',
    });
    if (encodedStreamHeaders) {
      params.set('headers', encodedStreamHeaders);
    }
    return `/api/transcode-stream?${params.toString()}`;
  }, [
    selectedStream?.link,
    isHlsStream,
    decoderMode,
    transcodeAvailable,
    useRawUrlFallback,
    transcodeOffset,
    selectedAudioTrackId,
    encodedStreamHeaders,
  ]);

  // Attach HLS.js or HTML5 Video source
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !resolvedVideoUrl) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setPlaybackError(null);
    setIsBuffering(true);

    const savedResumePos =
      activeEpisode?.link
        ? cacheStorage.getObject<number>(`resume_${activeEpisode.link}`) || 0
        : 0;

    if (isHlsStream && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        backBufferLength: 60,
      });
      hlsRef.current = hls;

      hls.loadSource(resolvedVideoUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const levels: QualityOption[] = [
          {id: -1, label: 'Auto', detail: 'Adaptive bitrate'},
        ];
        data.levels.forEach((lvl, idx) => {
          const height = lvl.height ? `${lvl.height}p` : `Level ${idx + 1}`;
          const kbps = lvl.bitrate
            ? lvl.bitrate >= 1000000
              ? `${(lvl.bitrate / 1000000).toFixed(1)} Mbps`
              : `${Math.round(lvl.bitrate / 1000)} kbps`
            : undefined;
          levels.push({
            id: idx,
            label: height,
            detail: [
              kbps,
              lvl.width && lvl.height ? `${lvl.width}x${lvl.height}` : null,
            ]
              .filter(Boolean)
              .join(' · '),
          });
        });
        setQualityOptions(levels);

        if (hls.audioTracks && hls.audioTracks.length > 0) {
          setHlsAudioTracks(
            hls.audioTracks.map((t, idx) => ({
              id: idx,
              label: formatLang(t.lang, t.name || `Audio ${idx + 1}`),
              detail: t.name,
              language: t.lang,
              source: 'hls' as const,
            })),
          );
          setSelectedAudioTrackId(hls.audioTrack >= 0 ? hls.audioTrack : 0);
        }

        if (savedResumePos > 5) {
          video.currentTime = savedResumePos;
        }
        video.playbackRate = playbackSpeed;
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
        setHlsAudioTracks(
          data.audioTracks.map((t, idx) => ({
            id: idx,
            label: formatLang(t.lang, t.name || `Audio ${idx + 1}`),
            detail: t.name,
            language: t.lang,
            source: 'hls' as const,
          })),
        );
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            const switched = switchToNextStream();
            if (!switched) {
              setPlaybackError(
                `HLS Playback Error: ${data.details || 'Stream unreachable'}`,
              );
              setIsBuffering(false);
            }
          }
        }
      });
    } else {
      setQualityOptions([{id: -1, label: 'Auto', detail: 'Direct stream'}]);
      setSelectedQualityId(-1);
      setHlsAudioTracks([]);

      video.src = resolvedVideoUrl;
      video.onloadedmetadata = () => {
        if (!isUsingTranscodeEngine && savedResumePos > 5 && savedResumePos < (video.duration || Infinity) - 10) {
          video.currentTime = savedResumePos;
        }
        video.playbackRate = playbackSpeed;
        video.play().catch(() => {});
      };
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [resolvedVideoUrl]);

  // Load and convert selected subtitle into WebVTT blob URL
  useEffect(() => {
    let active = true;
    let createdBlob: string | null = null;

    async function loadSub() {
      if (selectedSubtitleId === 'off') {
        setActiveVttBlobUrl(null);
        return;
      }
      const track = subtitleTracks.find(t => t.id === selectedSubtitleId);
      if (!track?.uri) {
        setActiveVttBlobUrl(null);
        return;
      }

      try {
        let subUrl = track.uri;
        if (!subUrl.startsWith('blob:') && !subUrl.startsWith('/api/')) {
          subUrl = `/api/stream-proxy?url=${encodeURIComponent(track.uri)}`;
        } else if (subUrl.startsWith('/api/subtitle-extract') && isUsingTranscodeEngine && transcodeOffset > 0) {
          subUrl = `${subUrl}&start=${Math.floor(transcodeOffset)}`;
        }
        const res = await fetch(subUrl);
        const text = await res.text();
        if (!active) return;
        const vtt = text.trimStart().startsWith('WEBVTT')
          ? text
          : convertSrtToVtt(text);
        const blob = new Blob([vtt], {type: 'text/vtt'});
        createdBlob = URL.createObjectURL(blob);
        setActiveVttBlobUrl(createdBlob);
      } catch {
        if (active) setActiveVttBlobUrl(null);
      }
    }

    loadSub();
    return () => {
      active = false;
      if (createdBlob) URL.revokeObjectURL(createdBlob);
    };
  }, [selectedSubtitleId, subtitleTracks, isUsingTranscodeEngine, transcodeOffset]);

  // Auto-hide controls after 3.5s of inactivity
  useEffect(() => {
    if (!showControls || !isPlaying) return;
    const timer = setTimeout(() => {
      if (!settingsOpen && !episodeDrawerOpen) {
        setShowControls(false);
      }
    }, 3500);
    return () => clearTimeout(timer);
  }, [showControls, isPlaying, settingsOpen, episodeDrawerOpen]);

  // Countdown Sleep Timer
  useEffect(() => {
    if (typeof sleepOption !== 'number' || sleepOption <= 0) {
      setSleepMinutesLeft(null);
      return;
    }
    setSleepMinutesLeft(sleepOption);
    const interval = setInterval(() => {
      setSleepMinutesLeft(prev => {
        if (prev === null || prev <= 1) {
          videoRef.current?.pause();
          setSleepOption('off');
          showToast('Sleep timer paused playback');
          return null;
        }
        return prev - 1;
      });
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [sleepOption, showToast]);

  const seekTo = useCallback(
    (targetSec: number) => {
      const video = videoRef.current;
      if (!video) return;
      const maxDur = duration > 0 ? duration : video.duration || 0;
      const clamped = Math.max(
        0,
        maxDur > 0 ? Math.min(maxDur - 1, targetSec) : targetSec,
      );

      if (isUsingTranscodeEngine) {
        // Check if target is already within buffered range of current transcode stream
        const relTarget = clamped - transcodeOffset;
        if (
          relTarget >= 0 &&
          video.buffered.length > 0 &&
          relTarget <= video.buffered.end(video.buffered.length - 1)
        ) {
          video.currentTime = relTarget;
          setRawVideoTime(relTarget);
        } else {
          setIsBuffering(true);
          setRawVideoTime(0);
          setTranscodeOffset(Math.floor(clamped));
        }
      } else {
        video.currentTime = clamped;
        setRawVideoTime(clamped);
      }
    },
    [duration, isUsingTranscodeEngine, transcodeOffset],
  );

  const seekBy = useCallback(
    (deltaSec: number, side?: 'left' | 'right') => {
      seekTo(currentTime + deltaSec);
      if (side) {
        setSkipFeedback({side, seconds: Math.abs(deltaSec)});
        setTimeout(() => setSkipFeedback(null), 650);
      }
    },
    [currentTime, seekTo],
  );

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const cycleDecoderMode = () => {
    const savedPos = Math.floor(currentTime);
    const order: DecoderMode[] = ['hw', 'sw', 'direct'];
    const next = order[(order.indexOf(decoderMode) + 1) % order.length];
    if (next === 'direct') {
      setTranscodeOffset(0);
    } else {
      setTranscodeOffset(savedPos);
    }
    setDecoderMode(next);
    const label =
      next === 'hw'
        ? 'HW Decoder (FFmpeg Remux)'
        : next === 'sw'
          ? 'SW Decoder (FFmpeg Transcode)'
          : 'Direct Stream';
    showToast(`Switched to ${label}`);
  };

  const handleToggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleTogglePip = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if ((video as any).requestPictureInPicture) {
        await (video as any).requestPictureInPicture();
      }
    } catch {
      showToast('Picture-in-Picture is not supported for this stream');
    }
  };

  const handleSelectQuality = (levelId: number) => {
    setSelectedQualityId(levelId);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelId;
    }
  };

  const handleSelectAudioTrack = (track: AudioTrackItem) => {
    const savedPos = Math.floor(currentTime);
    setSelectedAudioTrackId(track.id);
    if (track.source === 'hls' && hlsRef.current) {
      hlsRef.current.audioTrack = track.id;
    } else {
      // Switch audio track via transcode engine at current position
      if (decoderMode === 'direct') {
        setDecoderMode('hw');
      }
      setTranscodeOffset(savedPos);
    }
    showToast(`Audio: ${track.label}`);
    setSettingsOpen(false);
  };

  const handleChangeSpeed = (speed: number) => {
    const rounded = Math.max(0.25, Math.min(2.0, Math.round(speed * 20) / 20));
    setPlaybackSpeed(rounded);
    settingsStorage.setPlaybackSpeed(rounded);
    if (videoRef.current) {
      videoRef.current.playbackRate = rounded;
    }
  };

  const cycleResizeMode = () => {
    const idx = PLAYER_RESIZE_MODES.findIndex(m => m.mode === resizeMode);
    const nextItem = PLAYER_RESIZE_MODES[(idx + 1) % PLAYER_RESIZE_MODES.length];
    setResizeMode(nextItem.mode);
    settingsStorage.setDefaultResizeMode(nextItem.mode);
    showToast(`Video Fit: ${nextItem.label}`);
  };

  const handleUploadLocalSubtitle = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    const newSub = {
      title: file.name,
      language: 'local',
      type: 'text/vtt' as const,
      uri: blobUrl,
    };
    const nextSubs = [...externalSubs, newSub];
    setExternalSubs(nextSubs);
    setSelectedSubtitleId(`ext-${nextSubs.length - 1}`);
    setSettingsOpen(false);
    showToast(`Loaded subtitle: ${file.name}`);
  };

  const handlePickLocalVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    setDecoderMode('direct');
    setTranscodeOffset(0);
    setSelectedStream({
      server: `Local: ${file.name}`,
      link: blobUrl,
      type: 'mp4',
    });
    setSettingsOpen(false);
    showToast(`Playing local file: ${file.name}`);
  };

  const openSettingsTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSettingsOpen(true);
  };

  const activeSkipInterval = useMemo(() => {
    const skips =
      selectedStream.skip || activeEpisode?.skip || routeParams.skip || [];
    for (const s of skips) {
      const start = s.startTime ?? s.from;
      const end = s.endTime ?? s.to;
      if (
        typeof start === 'number' &&
        typeof end === 'number' &&
        currentTime >= start &&
        currentTime < end
      ) {
        return {
          label: s.type || s.title || 'Intro',
          startTime: start,
          endTime: end,
        };
      }
    }
    return undefined;
  }, [selectedStream.skip, activeEpisode?.skip, routeParams.skip, currentTime]);

  const allSkipIntervals = useMemo(() => {
    const raw =
      selectedStream.skip || activeEpisode?.skip || routeParams.skip || [];
    return raw
      .map(s => ({
        from: s.startTime ?? s.from ?? 0,
        to: s.endTime ?? s.to ?? 0,
        label: s.type || s.title || 'Skip',
      }))
      .filter(s => s.to > s.from);
  }, [selectedStream.skip, activeEpisode?.skip, routeParams.skip]);

  const hasNextEpisode =
    Boolean(routeParams.linkList) &&
    episodeIndex + 1 < routeParams.linkList.length;

  const objectFitClass =
    resizeMode === 'cover'
      ? 'object-cover'
      : resizeMode === 'stretch'
        ? 'object-fill'
        : 'object-contain';

  const resizeLabel =
    resizeMode === 'cover'
      ? 'Cover'
      : resizeMode === 'stretch'
        ? 'Stretch'
        : resizeMode === 'none'
          ? 'Fit'
          : 'Contain';

  const selectedAudioLabel =
    audioTracks.find(t => t.id === selectedAudioTrackId)?.label || 'Auto';

  const selectedSubLabel =
    selectedSubtitleId === 'off'
      ? 'None'
      : subtitleTracks.find(t => t.id === selectedSubtitleId)?.title || 'Sub';

  const serverQualityLabel =
    selectedQualityId >= 0
      ? qualityOptions.find(q => q.id === selectedQualityId)?.label || 'Server'
      : selectedStream.quality
        ? `${selectedStream.quality}p`
        : probedResolution || selectedStream.server || 'Server';

  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const bufferedPercent =
    duration > 0
      ? Math.min(
          100,
          Math.max(
            0,
            ((isUsingTranscodeEngine
              ? transcodeOffset + bufferedEnd
              : bufferedEnd) /
              duration) *
              100,
          ),
        )
      : 0;

  // Absolute proxy URL for external players (VLC, MX Player, Outplayer, etc.)
  const absoluteDirectStreamUrl = useMemo(() => {
    if (!selectedStream?.link) return '';
    if (selectedStream.link.startsWith('http')) {
      const hasCustomHeaders = Boolean(encodedStreamHeaders);
      if (!hasCustomHeaders) return selectedStream.link;
      return `${window.location.origin}/api/stream-proxy?url=${encodeURIComponent(
        selectedStream.link,
      )}&headers=${encodeURIComponent(encodedStreamHeaders)}`;
    }
    return `${window.location.origin}${selectedStream.link}`;
  }, [selectedStream?.link, encodedStreamHeaders]);

  return (
    <div
      ref={containerRef}
      onMouseMove={() => {
        if (!isLocked) setShowControls(true);
      }}
      onClick={() => {
        if (isLocked) {
          setShowUnlockPill(true);
          setTimeout(() => setShowUnlockPill(false), 3000);
        } else {
          setShowControls(prev => !prev);
        }
      }}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden select-none">
      {/* Hidden File Inputs */}
      <input
        ref={subFileInputRef}
        type="file"
        accept=".srt,.vtt,.ass,.ssa"
        className="hidden"
        onChange={handleUploadLocalSubtitle}
      />
      <input
        ref={localVideoInputRef}
        type="file"
        accept="video/*,.mkv,.mp4,.webm"
        className="hidden"
        onChange={handlePickLocalVideo}
      />

      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        className={`w-full h-full ${objectFitClass}`}
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setPlaybackError(null);
        }}
        onCanPlay={() => setIsBuffering(false)}
        onTimeUpdate={e => {
          const v = e.currentTarget;
          setRawVideoTime(v.currentTime);
          if (v.duration && Number.isFinite(v.duration)) {
            setRawVideoDuration(v.duration);
          }
          if (v.buffered.length > 0) {
            setBufferedEnd(v.buffered.end(v.buffered.length - 1));
          }
          const effectiveNow = isUsingTranscodeEngine
            ? transcodeOffset + v.currentTime
            : v.currentTime;
          const effectiveDur = probedDuration || v.duration || 0;

          if (activeEpisode?.link && effectiveNow > 3) {
            cacheStorage.setObject(`resume_${activeEpisode.link}`, effectiveNow);
            updateProgress(
              routeParams.infoUrl || routeParams.primaryTitle || '',
              effectiveNow,
              effectiveDur,
              activeEpisode,
            );
            if (effectiveDur > 0 && effectiveNow / effectiveDur > 0.9) {
              cacheStorage.setBool(`watched_${activeEpisode.link}`, true);
            }
          }
        }}
        onEnded={() => {
          if (sleepOption === 'episode') {
            setSleepOption('off');
            showToast('Sleep timer: Paused at end of episode');
            return;
          }
          if (activeEpisode?.link) {
            cacheStorage.setBool(`watched_${activeEpisode.link}`, true);
            const nextEp = hasNextEpisode
              ? routeParams.linkList[episodeIndex + 1]
              : undefined;
            finishEpisode(
              routeParams.infoUrl || routeParams.primaryTitle || '',
              activeEpisode,
              nextEp,
            );
            if (
              hasNextEpisode &&
              settingsStorage.isAutoPlayNextEpisodeEnabled()
            ) {
              setEpisodeIndex(i => i + 1);
            }
          }
        }}
        onError={() => {
          // Automatic decoder fallback:
          // 1. If in 'direct' and transcode is available, try HW Remux -> SW Transcode
          // 2. If in 'hw' or 'sw' and transcode fails, fall back to 'direct' + raw URL
          // 3. If in 'direct' via /api/stream-proxy and it fails, try raw direct URL before switching servers
          if (
            decoderMode === 'direct' &&
            transcodeAvailable === true &&
            !isLocalBlob &&
            !isHlsStream
          ) {
            setTranscodeOffset(Math.floor(currentTime));
            setDecoderMode('hw');
            showToast('Switching to HW Remux Decoder...');
            return;
          }
          if (
            decoderMode === 'hw' &&
            transcodeAvailable === true &&
            !isLocalBlob &&
            !isHlsStream
          ) {
            setTranscodeOffset(Math.floor(currentTime));
            setDecoderMode('sw');
            showToast('Switching to SW H.264 Decoder...');
            return;
          }
          if (decoderMode !== 'direct') {
            setTranscodeOffset(0);
            setDecoderMode('direct');
            setUseRawUrlFallback(true);
            showToast('Switching to Direct Stream...');
            return;
          }
          if (!useRawUrlFallback && !isLocalBlob) {
            setUseRawUrlFallback(true);
            return;
          }
          const switched = switchToNextStream();
          if (!switched) {
            setPlaybackError(
              'Stream failed to load or format is unsupported. Try switching server or opening in an external player.',
            );
            setIsBuffering(false);
          }
        }}>
        {activeVttBlobUrl && (
          <track
            kind="subtitles"
            src={activeVttBlobUrl}
            srcLang="en"
            label="Subtitles"
            default
          />
        )}
      </video>

      {/* Double-Tap Left / Right Gesture Zones */}
      {!isLocked && (
        <>
          <div
            onDoubleClick={e => {
              e.stopPropagation();
              seekBy(-seekInterval, 'left');
            }}
            className="absolute left-0 top-16 bottom-28 w-1/4 z-10"
          />
          <div
            onDoubleClick={e => {
              e.stopPropagation();
              seekBy(seekInterval, 'right');
            }}
            className="absolute right-0 top-16 bottom-28 w-1/4 z-10"
          />
        </>
      )}

      {/* Double-Tap Skip Feedback Overlay */}
      {skipFeedback && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 z-30 px-5 py-3 rounded-full bg-black/70 text-white font-bold text-sm flex items-center gap-2 pointer-events-none animate-pulse ${
            skipFeedback.side === 'left' ? 'left-12' : 'right-12'
          }`}>
          {skipFeedback.side === 'left' ? (
            <>
              <RotateCcw size={18} />
              <span>-{skipFeedback.seconds}s</span>
            </>
          ) : (
            <>
              <span>+{skipFeedback.seconds}s</span>
              <RotateCw size={18} />
            </>
          )}
        </div>
      )}

      {/* Vega Toast Banner */}
      {toastMessage && (
        <div
          className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-semibold text-white shadow-xl pointer-events-none"
          style={{backgroundColor: 'rgba(20,20,20,0.92)', border: '1px solid rgba(255,255,255,0.12)'}}>
          {toastMessage}
        </div>
      )}

      {/* Initial Stream Resolution Loading Screen (Matches Vega App) */}
      {streamLoading && !streamError && !playbackError && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-30">
          <button
            onClick={e => {
              e.stopPropagation();
              goBack();
            }}
            className="absolute top-4 left-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer">
            <ArrowLeft size={22} />
          </button>
          <div
            className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin mb-3"
            style={{borderColor: colors.primary, borderTopColor: 'transparent'}}
          />
          <p className="text-sm font-bold text-white">
            Resolving streams...
          </p>
          <p className="text-xs text-white/60 mt-1">
            {activeEpisode?.title || routeParams.primaryTitle}
          </p>
        </div>
      )}

      {/* Playback Error Overlay */}
      {(streamError || playbackError) && (
        <div
          onClick={e => e.stopPropagation()}
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 p-6">
          <div
            className="max-w-md w-full rounded-3xl p-6 border text-center"
            style={{
              backgroundColor: '#171717',
              borderColor: '#333333',
            }}>
            <AlertTriangle
              size={36}
              className="mx-auto mb-3"
              style={{color: colors.error}}
            />
            <h3 className="text-lg font-bold mb-1 text-white">
              Playback Error
            </h3>
            <p className="text-xs leading-relaxed mb-5 text-white/70">
              {streamError instanceof Error
                ? streamError.message
                : playbackError || 'Could not resolve playable stream.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                onClick={goBack}
                className="px-4 py-2 rounded-full text-xs font-semibold border border-white/20 text-white cursor-pointer">
                Go Back
              </button>
              {streams.length > 1 && (
                <button
                  onClick={() => openSettingsTab('server')}
                  className="px-4 py-2 rounded-full text-xs font-semibold bg-[#292929] text-white cursor-pointer">
                  Switch Server ({streams.length})
                </button>
              )}
              {selectedStream?.link && (
                <button
                  onClick={() => openSettingsTab('external')}
                  className="px-4 py-2 rounded-full text-xs font-semibold bg-[#292929] text-white cursor-pointer">
                  External Player
                </button>
              )}
              <button
                onClick={() => {
                  setPlaybackError(null);
                  refetchStreams();
                }}
                className="px-5 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                style={{
                  backgroundColor: colors.primary,
                  color: colors.onPrimary,
                }}>
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Button when Player is Locked (Exact Vega top-right lock pill) */}
      {isLocked && showUnlockPill && (
        <button
          onClick={e => {
            e.stopPropagation();
            setIsLocked(false);
            setShowControls(true);
            showToast('Player unlocked');
          }}
          className="absolute top-3 right-5 z-50 p-3 rounded-full bg-black/75 border border-white/15 text-white flex items-center gap-2 text-xs font-semibold cursor-pointer">
          <Lock size={18} />
          <span>Tap to Unlock</span>
        </button>
      )}

      {/* Floating Skip Intro / Recap / Credits Button (Exact Vega position: bottom 95, right 28) */}
      {activeSkipInterval && !streamLoading && !isLocked && (
        <button
          onClick={e => {
            e.stopPropagation();
            seekTo(activeSkipInterval.endTime);
          }}
          className="absolute bottom-24 right-7 z-30 px-5 py-2.5 rounded-full font-bold text-xs shadow-2xl flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
          style={{
            backgroundColor: colors.primary,
            color: colors.onPrimary,
          }}>
          <SkipForward size={14} fill="currentColor" />
          <span>Skip {activeSkipInterval.label}</span>
        </button>
      )}

      {/* ==================== VEGA MEDIA CONSOLE OVERLAY ==================== */}
      {showControls && !isLocked && !streamLoading && (
        <div
          onClick={e => e.stopPropagation()}
          className="absolute inset-0 z-20 flex flex-col justify-between bg-black/45 pointer-events-none">
          {/* 1. TOP ROW: Vega Title Pill (Left) + Vega Top Control Pill (Right) */}
          <div className="flex items-start justify-between gap-3 m-3 sm:m-4 pointer-events-auto">
            {/* Left: Vega Title Pill */}
            <div
              className="flex items-center gap-2.5 pl-2 pr-5 py-1.5 rounded-[28px] max-w-[60%] sm:max-w-[65%]"
              style={{backgroundColor: 'rgba(0,0,0,0.62)'}}>
              <button
                onClick={goBack}
                className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center text-white shrink-0 cursor-pointer"
                title="Back">
                <ArrowLeft size={20} />
              </button>
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-bold text-white truncate">
                  {activeEpisode?.title ||
                    routeParams.secondaryTitle ||
                    routeParams.primaryTitle ||
                    'Now Playing'}
                </h2>
                <p className="text-[11px] text-white/70 truncate">
                  {[
                    routeParams.primaryTitle,
                    routeParams.seasonTitle,
                    selectedStream.server,
                    isUsingTranscodeEngine
                      ? decoderMode === 'sw'
                        ? 'SW H.264'
                        : 'HW Remux'
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>

            {/* Right: Vega Top PlayerControlBar Pill (Decoder, Sleep, Lock, External, Volume) */}
            <div className="flex items-center gap-2">
              {/* Volume Quick Control (Desktop & Tablet) */}
              <div
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-[28px]"
                style={{backgroundColor: 'rgba(0,0,0,0.62)'}}>
                <button
                  onClick={() => {
                    const nextMuted = !isMuted;
                    setIsMuted(nextMuted);
                    if (videoRef.current) videoRef.current.muted = nextMuted;
                  }}
                  className="text-white/90 hover:text-white cursor-pointer">
                  {isMuted || volume === 0 ? (
                    <VolumeX size={18} />
                  ) : (
                    <Volume2 size={18} />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    setVolume(v);
                    setIsMuted(v === 0);
                    if (videoRef.current) {
                      videoRef.current.volume = v;
                      videoRef.current.muted = v === 0;
                    }
                  }}
                  className="w-16 accent-white cursor-pointer h-1"
                />
              </div>

              {/* Vega Top Control Pill */}
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-[28px]"
                style={{backgroundColor: 'rgba(0,0,0,0.62)'}}>
                {/* Decoder Button (HW / SW / DIR badge just like Vega Android) */}
                {!isLocalBlob && !isHlsStream && (
                  <button
                    onClick={cycleDecoderMode}
                    className="relative p-2 rounded-full hover:bg-white/10 text-white flex items-center justify-center cursor-pointer"
                    title="Switch Video Decoder (HW Remux / SW Transcode / Direct)">
                    <Cpu size={20} />
                    <span className="absolute -bottom-0.5 -right-0.5 px-1 py-[1px] rounded bg-[#141414] border border-white/70 text-[8px] font-extrabold text-white leading-none">
                      {decoderMode === 'hw'
                        ? 'HW'
                        : decoderMode === 'sw'
                          ? 'SW'
                          : 'DIR'}
                    </span>
                  </button>
                )}

                {/* Sleep Timer Button */}
                {showSleepTimerBtn && (
                  <button
                    onClick={() => openSettingsTab('sleep')}
                    className="relative p-2 rounded-full hover:bg-white/10 text-white flex items-center justify-center cursor-pointer"
                    title="Sleep timer">
                    <Moon size={20} />
                    {sleepOption !== 'off' && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 px-1 rounded text-[8px] font-bold text-black"
                        style={{backgroundColor: colors.primary}}>
                        {sleepOption === 'episode'
                          ? 'EP'
                          : `${sleepMinutesLeft ?? sleepOption}m`}
                      </span>
                    )}
                  </button>
                )}

                {/* Lock Player Button */}
                <button
                  onClick={() => {
                    setIsLocked(true);
                    setShowUnlockPill(true);
                    setTimeout(() => setShowUnlockPill(false), 2500);
                  }}
                  className="p-2 rounded-full hover:bg-white/10 text-white flex items-center justify-center cursor-pointer"
                  title="Lock player">
                  <Unlock size={20} />
                </button>

                {/* External Player / Cast Button */}
                <button
                  onClick={() => openSettingsTab('external')}
                  className="p-2 rounded-full hover:bg-white/10 text-white flex items-center justify-center cursor-pointer"
                  title="Open in External Player / Copy Stream Link">
                  <ExternalLink size={19} />
                </button>
              </div>
            </div>
          </div>

          {/* 2. CENTER ROW: Vega SeekControls & PlayPause */}
          <div className="flex items-center justify-center gap-12 sm:gap-20 pointer-events-auto">
            {!hideSeekButtons && (
              <button
                onClick={() => seekBy(-seekInterval, 'left')}
                className="relative w-14 h-14 rounded-full hover:bg-white/10 active:scale-95 flex items-center justify-center text-white/95 transition-transform cursor-pointer"
                title={`Rewind ${seekInterval}s`}>
                <RotateCcw size={38} strokeWidth={1.75} />
                <span className="absolute text-[10px] font-extrabold mt-0.5">
                  {seekInterval}
                </span>
              </button>
            )}

            <button
              onClick={togglePlay}
              className="w-20 h-20 rounded-full hover:bg-white/10 active:scale-95 flex items-center justify-center text-white transition-transform cursor-pointer">
              {isBuffering ? (
                <div
                  className="w-14 h-14 rounded-full border-4 border-t-transparent animate-spin"
                  style={{
                    borderColor: colors.primary,
                    borderTopColor: 'transparent',
                  }}
                />
              ) : isPlaying ? (
                <Pause size={56} fill="rgba(255,255,255,0.95)" strokeWidth={0} />
              ) : (
                <Play
                  size={56}
                  fill="rgba(255,255,255,0.95)"
                  strokeWidth={0}
                  className="ml-1"
                />
              )}
            </button>

            {!hideSeekButtons && (
              <button
                onClick={() => seekBy(seekInterval, 'right')}
                className="relative w-14 h-14 rounded-full hover:bg-white/10 active:scale-95 flex items-center justify-center text-white/95 transition-transform cursor-pointer"
                title={`Forward ${seekInterval}s`}>
                <RotateCw size={38} strokeWidth={1.75} />
                <span className="absolute text-[10px] font-extrabold mt-0.5">
                  {seekInterval}
                </span>
              </button>
            )}
          </div>

          {/* 3. BOTTOM AREA: Vega Seekbar + Vega Bottom Pill Control Bar */}
          <div className="w-full px-3 sm:px-6 pb-3 space-y-2.5 pointer-events-auto">
            {/* Vega Seekbar Row */}
            <div className="flex items-center justify-center gap-3 px-2 sm:px-8">
              <button
                onClick={() => setShowTimeRemaining(prev => !prev)}
                className="text-xs font-light tracking-wider text-[#b3b3b3] min-w-[48px] text-right cursor-pointer">
                {formatTime(currentTime, duration >= 3600)}
              </button>

              {/* Interactive Seek Track */}
              <div
                ref={seekTrackRef}
                onMouseMove={e => {
                  if (!seekTrackRef.current || duration <= 0) return;
                  const rect = seekTrackRef.current.getBoundingClientRect();
                  const ratio = Math.max(
                    0,
                    Math.min(1, (e.clientX - rect.left) / rect.width),
                  );
                  setHoverLeftPx(e.clientX - rect.left);
                  setHoverTime(ratio * duration);
                }}
                onMouseLeave={() => setHoverTime(null)}
                onClick={e => {
                  if (!seekTrackRef.current || duration <= 0) return;
                  const rect = seekTrackRef.current.getBoundingClientRect();
                  const ratio = Math.max(
                    0,
                    Math.min(1, (e.clientX - rect.left) / rect.width),
                  );
                  seekTo(ratio * duration);
                }}
                className="relative flex-1 h-6 flex items-center cursor-pointer group">
                {/* Hover Timestamp Preview Pill (Exact Vega Seekbar preview) */}
                {hoverTime !== null && duration > 0 && (
                  <div
                    className="absolute bottom-7 -translate-x-1/2 px-2.5 py-1 rounded-md bg-black/90 border border-white/15 text-[11px] font-semibold text-white whitespace-nowrap pointer-events-none z-20"
                    style={{left: hoverLeftPx}}>
                    {(() => {
                      const formatted = formatTime(hoverTime, duration >= 3600);
                      const diff = Math.round(hoverTime - currentTime);
                      if (Math.abs(diff) < 1) return formatted;
                      const sign = diff > 0 ? '+' : '-';
                      return `${formatted} (${sign}${formatTime(Math.abs(diff))})`;
                    })()}
                  </div>
                )}

                {/* Track Background */}
                <div className="relative w-full h-[3px] group-hover:h-[5px] bg-white/30 rounded-full overflow-hidden transition-all">
                  {/* Buffered Bar */}
                  <div
                    className="absolute inset-y-0 left-0 bg-[#dedede]/70"
                    style={{width: `${bufferedPercent}%`}}
                  />
                  {/* Active Fill Bar */}
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{
                      width: `${progressPercent}%`,
                      backgroundColor: colors.primary,
                    }}
                  />
                  {/* Skip Interval Black Ticks (Intro/Recap/Credits) */}
                  {duration > 0 &&
                    allSkipIntervals.map((sk, idx) => (
                      <React.Fragment key={idx}>
                        {sk.from > 0 && sk.from < duration && (
                          <div
                            className="absolute top-0 bottom-0 w-[3px] bg-black z-10"
                            style={{left: `${(sk.from / duration) * 100}%`}}
                          />
                        )}
                        {sk.to > 0 && sk.to < duration && (
                          <div
                            className="absolute top-0 bottom-0 w-[3px] bg-black z-10"
                            style={{left: `${(sk.to / duration) * 100}%`}}
                          />
                        )}
                      </React.Fragment>
                    ))}
                </div>

                {/* Seek Thumb Handle */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full shadow-md pointer-events-none transition-transform group-hover:scale-125"
                  style={{
                    left: `${progressPercent}%`,
                    backgroundColor: colors.primary,
                  }}
                />
              </div>

              <button
                onClick={() => setShowTimeRemaining(prev => !prev)}
                className="text-xs font-light tracking-wider text-[#b3b3b3] min-w-[54px] text-left cursor-pointer">
                {duration > 0
                  ? showTimeRemaining
                    ? `-${formatTime(Math.max(0, duration - currentTime), duration >= 3600)}`
                    : formatTime(duration, duration >= 3600)
                  : '--:--'}
              </button>
            </div>

            {/* Vega Bottom Floating Pill Toolbar (Exact PlayerControlBar match) */}
            <div className="mx-auto max-w-4xl">
              <div
                className="w-full rounded-[28px] px-4 py-1.5 overflow-x-auto no-scrollbar"
                style={{backgroundColor: 'rgba(0,0,0,0.65)'}}>
                <div className="flex items-center justify-between gap-4 min-w-max mx-auto px-2">
                  {/* Audio */}
                  <button
                    onClick={() => openSettingsTab('audio')}
                    className="min-h-[40px] px-2 py-1 flex items-center gap-1.5 text-white hover:text-white/80 cursor-pointer shrink-0">
                    <AudioWaveform size={20} />
                    <span className="text-xs font-light">
                      {selectedAudioLabel}
                    </span>
                  </button>

                  {/* Subtitles */}
                  <button
                    onClick={() => openSettingsTab('subtitle')}
                    className="min-h-[40px] px-2 py-1 flex items-center gap-1.5 text-white hover:text-white/80 cursor-pointer shrink-0">
                    <Subtitles size={20} />
                    <span className="text-xs font-light">
                      {selectedSubLabel}
                    </span>
                  </button>

                  {/* Playback Speed */}
                  <button
                    onClick={() => openSettingsTab('speed')}
                    className="min-h-[40px] px-2 py-1 flex items-center gap-1.5 text-white hover:text-white/80 cursor-pointer shrink-0">
                    <Gauge size={20} />
                    <span className="text-xs font-light">
                      {Number.isInteger(playbackSpeed)
                        ? `${playbackSpeed.toFixed(1)}x`
                        : `${playbackSpeed}x`}
                    </span>
                  </button>

                  {/* Picture in Picture */}
                  <button
                    onClick={handleTogglePip}
                    className="min-h-[40px] px-2 py-1 flex items-center gap-1.5 text-white hover:text-white/80 cursor-pointer shrink-0">
                    <PictureInPicture2 size={20} />
                    <span className="text-xs font-light">PIP</span>
                  </button>

                  {/* Server & Quality */}
                  <button
                    onClick={() => openSettingsTab('server')}
                    className="min-h-[40px] px-2 py-1 flex items-center gap-1.5 text-white hover:text-white/80 cursor-pointer shrink-0">
                    <Server size={20} />
                    <span className="text-xs font-light">
                      {serverQualityLabel}
                    </span>
                  </button>

                  {/* Video Fit / Resize */}
                  <button
                    onClick={cycleResizeMode}
                    className="min-h-[40px] px-2 py-1 flex items-center gap-1.5 text-white hover:text-white/80 cursor-pointer shrink-0">
                    <Maximize2 size={19} />
                    <span className="text-xs font-light">{resizeLabel}</span>
                  </button>

                  {/* Episodes Sidebar */}
                  {showEpisodeSidebarBtn &&
                    routeParams.linkList &&
                    routeParams.linkList.length > 1 && (
                      <button
                        onClick={() => setEpisodeDrawerOpen(true)}
                        className="min-h-[40px] px-2 py-1 flex items-center gap-1.5 text-white hover:text-white/80 cursor-pointer shrink-0">
                        <ListVideo size={21} />
                        <span className="text-xs font-light">Episodes</span>
                      </button>
                    )}

                  {/* Next Episode */}
                  {hasNextEpisode && (
                    <button
                      onClick={() =>
                        setEpisodeIndex(i =>
                          Math.min(routeParams.linkList.length - 1, i + 1),
                        )
                      }
                      className="min-h-[40px] px-2 py-1 flex items-center gap-1.5 text-white hover:text-white/80 cursor-pointer shrink-0">
                      <SkipForward size={20} />
                      <span className="text-xs font-light">Next</span>
                    </button>
                  )}

                  {/* Fullscreen */}
                  <button
                    onClick={handleToggleFullscreen}
                    className="min-h-[40px] px-2 py-1 flex items-center gap-1.5 text-white hover:text-white/80 cursor-pointer shrink-0"
                    title="Fullscreen">
                    {isFullscreen ? (
                      <Minimize size={20} />
                    ) : (
                      <Maximize size={20} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== VEGA UNIFIED PLAYER SETTINGS MODAL ==================== */}
      {settingsOpen && (
        <div
          onClick={() => setSettingsOpen(false)}
          className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl rounded-[22px] p-4 border shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            style={{
              backgroundColor: '#171717',
              borderColor: '#2e2e2e',
            }}>
            {/* Modal Top Tab Strip + Close Button */}
            <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {(
                  [
                    {id: 'server', label: 'Server & Quality'},
                    {id: 'audio', label: 'Audio'},
                    {id: 'subtitle', label: 'Subtitle'},
                    {id: 'speed', label: 'Speed'},
                    {id: 'sleep', label: 'Sleep Timer'},
                    {id: 'external', label: 'External Player'},
                  ] as {id: SettingsTab; label: string}[]
                ).map(t => {
                  const active = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className="px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors shrink-0 cursor-pointer"
                      style={{
                        backgroundColor: active ? '#383838' : '#242424',
                        color: active ? colors.primary : '#ffffff',
                      }}>
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setSettingsOpen(false)}
                className="w-9 h-9 rounded-full bg-[#292929] hover:bg-[#383838] flex items-center justify-center text-white shrink-0 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Tab Content Area */}
            <div className="flex-1 overflow-y-auto pr-1">
              {/* TAB 1: SERVER & QUALITY (Exact Vega 2-Column PlayerSourceMenu) */}
              {activeTab === 'server' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Server Column */}
                  <div>
                    <h4 className="text-center text-white text-base font-extrabold mb-2">
                      Server
                    </h4>
                    <div className="space-y-1.5">
                      {streams.map((item, idx) => {
                        const selected =
                          item.link === selectedStream.link &&
                          item.server === selectedStream.server;
                        const tags = (item.tags || []).filter(
                          tg =>
                            tg &&
                            tg.toLowerCase() !==
                              String(item.quality || '').toLowerCase(),
                        );
                        return (
                          <button
                            key={`${idx}:${item.link}`}
                            onClick={() => {
                              setSelectedStream(item);
                              setSettingsOpen(false);
                            }}
                            className="w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
                            style={{
                              backgroundColor: selected ? '#303030' : '#222222',
                              borderColor: selected ? colors.primary : '#303030',
                            }}>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-sm font-bold truncate"
                                  style={{
                                    color: selected ? colors.primary : '#ffffff',
                                  }}>
                                  {item.server || `Server ${idx + 1}`}
                                </span>
                                {item.quality && (
                                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-white shrink-0">
                                    {item.quality}p
                                  </span>
                                )}
                              </div>
                              {(tags.length > 0 || item.type) && (
                                <p className="text-[11px] text-white/60 mt-0.5 truncate">
                                  {[item.type?.toUpperCase(), ...tags]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </p>
                              )}
                            </div>
                            {selected && (
                              <Check size={16} style={{color: colors.primary}} />
                            )}
                          </button>
                        );
                      })}

                      {/* Local Video Row */}
                      <div className="pt-2 mt-2 border-t border-white/10">
                        <button
                          onClick={() => localVideoInputRef.current?.click()}
                          className="w-full p-3 rounded-2xl border border-[#303030] bg-[#222222] hover:bg-[#2c2c2c] text-left flex items-center gap-3 cursor-pointer">
                          <FolderOpen size={18} style={{color: colors.primary}} />
                          <div>
                            <p className="text-sm font-bold text-white">
                              Local video
                            </p>
                            <p className="text-[11px] text-white/60">
                              Choose a file from this device
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Quality & Decoder Column */}
                  <div className="border-t sm:border-t-0 sm:border-l border-white/10 pt-3 sm:pt-0 sm:pl-4">
                    <h4 className="text-center text-white text-base font-extrabold mb-2">
                      Quality & Decoder
                    </h4>
                    <div className="space-y-1.5">
                      {qualityOptions.map(q => {
                        const selected = selectedQualityId === q.id;
                        return (
                          <button
                            key={q.id}
                            onClick={() => {
                              handleSelectQuality(q.id);
                              setSettingsOpen(false);
                            }}
                            className="w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-2 cursor-pointer"
                            style={{
                              backgroundColor: selected ? '#303030' : '#222222',
                              borderColor: selected ? colors.primary : '#303030',
                            }}>
                            <div>
                              <p
                                className="text-sm font-bold"
                                style={{
                                  color: selected ? colors.primary : '#ffffff',
                                }}>
                                {q.label}
                              </p>
                              {q.detail && (
                                <p className="text-[11px] text-white/60">
                                  {q.detail}
                                </p>
                              )}
                            </div>
                            {selected && (
                              <Check size={16} style={{color: colors.primary}} />
                            )}
                          </button>
                        );
                      })}

                      {!isLocalBlob && !isHlsStream && (
                        <div className="pt-3 mt-3 border-t border-white/10 space-y-1.5">
                          <p className="text-xs font-bold text-white/70 mb-1">
                            Stream Decoder Engine
                          </p>
                          {(
                            [
                              {
                                id: 'hw',
                                title: 'HW Remux (Recommended for MKV)',
                                detail:
                                  'Lossless video copy + stereo AAC audio via FFmpeg',
                              },
                              {
                                id: 'sw',
                                title: 'SW Transcode (Maximum Compatibility)',
                                detail:
                                  'Converts HEVC / 10-bit video to H.264 + AAC on the fly',
                              },
                              {
                                id: 'direct',
                                title: 'Direct Stream Proxy',
                                detail: 'Raw byte-range stream without remuxing',
                              },
                            ] as {id: DecoderMode; title: string; detail: string}[]
                          ).map(dec => {
                            const active = decoderMode === dec.id;
                            return (
                              <button
                                key={dec.id}
                                onClick={() => {
                                  const pos = Math.floor(currentTime);
                                  setTranscodeOffset(dec.id === 'direct' ? 0 : pos);
                                  setDecoderMode(dec.id);
                                  setSettingsOpen(false);
                                  showToast(`Switched to ${dec.title}`);
                                }}
                                className="w-full p-2.5 rounded-2xl border text-left flex items-center justify-between gap-2 cursor-pointer"
                                style={{
                                  backgroundColor: active ? '#303030' : '#222222',
                                  borderColor: active ? colors.primary : '#303030',
                                }}>
                                <div>
                                  <p
                                    className="text-xs font-bold"
                                    style={{
                                      color: active ? colors.primary : '#ffffff',
                                    }}>
                                    {dec.title}
                                  </p>
                                  <p className="text-[10px] text-white/60">
                                    {dec.detail}
                                  </p>
                                </div>
                                {active && (
                                  <Check
                                    size={15}
                                    style={{color: colors.primary}}
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: AUDIO (Vega PlayerDelayControl + Audio Tracks) */}
              {activeTab === 'audio' && (
                <div className="space-y-3">
                  <h4 className="text-center text-white text-base font-extrabold">
                    Audio
                  </h4>

                  {/* Audio Delay Control */}
                  <div className="p-3 rounded-2xl bg-[#222222] border border-[#303030] flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">Audio delay</p>
                      <p className="text-[11px] text-white/60">
                        {audioDelayMs === 0
                          ? '0 ms (In sync)'
                          : audioDelayMs > 0
                            ? `+${audioDelayMs} ms (Sound plays later)`
                            : `${audioDelayMs} ms (Sound plays earlier)`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAudioDelayMs(d => d - 50)}
                        className="w-8 h-8 rounded-full bg-[#303030] hover:bg-[#3d3d3d] text-white flex items-center justify-center cursor-pointer">
                        <Minus size={15} />
                      </button>
                      <button
                        onClick={() => setAudioDelayMs(0)}
                        className="px-2.5 py-1 rounded-lg bg-[#303030] text-xs font-bold text-white cursor-pointer">
                        Reset
                      </button>
                      <button
                        onClick={() => setAudioDelayMs(d => d + 50)}
                        className="w-8 h-8 rounded-full bg-[#303030] hover:bg-[#3d3d3d] text-white flex items-center justify-center cursor-pointer">
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>

                  {audioTracks.length === 0 ? (
                    <p className="text-xs text-center text-white/60 py-6">
                      Default audio track active
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {audioTracks.map(track => {
                        const selected = selectedAudioTrackId === track.id;
                        return (
                          <button
                            key={track.id}
                            onClick={() => handleSelectAudioTrack(track)}
                            className="w-full p-3 rounded-2xl border text-left flex items-center justify-between cursor-pointer"
                            style={{
                              backgroundColor: selected ? '#303030' : '#222222',
                              borderColor: selected ? colors.primary : '#303030',
                            }}>
                            <div>
                              <p
                                className="text-sm font-bold"
                                style={{
                                  color: selected ? colors.primary : '#ffffff',
                                }}>
                                {track.label}
                              </p>
                              {track.detail && (
                                <p className="text-[11px] text-white/60">
                                  {track.detail}
                                </p>
                              )}
                            </div>
                            {selected && (
                              <Check size={16} style={{color: colors.primary}} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: SUBTITLES (Vega Subtitle Delay + Tracks + External File) */}
              {activeTab === 'subtitle' && (
                <div className="space-y-3">
                  <h4 className="text-center text-white text-base font-extrabold">
                    Subtitle
                  </h4>

                  {selectedSubtitleId !== 'off' && (
                    <div className="p-3 rounded-2xl bg-[#222222] border border-[#303030] flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-white">
                          Subtitle delay
                        </p>
                        <p className="text-[11px] text-white/60">
                          {subtitleDelayMs === 0
                            ? '0 ms (In sync)'
                            : subtitleDelayMs > 0
                              ? `+${subtitleDelayMs} ms (Text shows later)`
                              : `${subtitleDelayMs} ms (Text shows earlier)`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSubtitleDelayMs(d => d - 100)}
                          className="w-8 h-8 rounded-full bg-[#303030] text-white flex items-center justify-center cursor-pointer">
                          <Minus size={15} />
                        </button>
                        <button
                          onClick={() => setSubtitleDelayMs(0)}
                          className="px-2.5 py-1 rounded-lg bg-[#303030] text-xs font-bold text-white cursor-pointer">
                          Reset
                        </button>
                        <button
                          onClick={() => setSubtitleDelayMs(d => d + 100)}
                          className="w-8 h-8 rounded-full bg-[#303030] text-white flex items-center justify-center cursor-pointer">
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <button
                      onClick={() => {
                        setSelectedSubtitleId('off');
                        setSettingsOpen(false);
                      }}
                      className="w-full p-3 rounded-2xl border text-left flex items-center justify-between cursor-pointer"
                      style={{
                        backgroundColor:
                          selectedSubtitleId === 'off' ? '#303030' : '#222222',
                        borderColor:
                          selectedSubtitleId === 'off'
                            ? colors.primary
                            : '#303030',
                      }}>
                      <span
                        className="text-sm font-bold"
                        style={{
                          color:
                            selectedSubtitleId === 'off'
                              ? colors.primary
                              : '#ffffff',
                        }}>
                        Disabled
                      </span>
                      {selectedSubtitleId === 'off' && (
                        <Check size={16} style={{color: colors.primary}} />
                      )}
                    </button>

                    {subtitleTracks.map(sub => {
                      const active = selectedSubtitleId === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => {
                            setSelectedSubtitleId(sub.id);
                            setSettingsOpen(false);
                          }}
                          className="w-full p-3 rounded-2xl border text-left flex items-center justify-between cursor-pointer"
                          style={{
                            backgroundColor: active ? '#303030' : '#222222',
                            borderColor: active ? colors.primary : '#303030',
                          }}>
                          <div>
                            <p
                              className="text-sm font-bold"
                              style={{
                                color: active ? colors.primary : '#ffffff',
                              }}>
                              {sub.title}
                            </p>
                            {sub.detail && (
                              <p className="text-[11px] text-white/60">
                                {sub.detail}
                              </p>
                            )}
                          </div>
                          {active && (
                            <Check size={16} style={{color: colors.primary}} />
                          )}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => subFileInputRef.current?.click()}
                      className="w-full p-3 rounded-2xl border border-[#303030] bg-[#222222] hover:bg-[#2c2c2c] text-left flex items-center gap-2.5 cursor-pointer">
                      <Plus size={18} style={{color: colors.primary}} />
                      <span className="text-sm font-bold text-white">
                        Add external file (.srt / .vtt)
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: PLAYBACK SPEED (Exact Vega PlayerSpeedControl) */}
              {activeTab === 'speed' && (
                <div className="space-y-4 py-2 px-2">
                  <div className="text-center">
                    <p className="text-white text-sm font-bold">
                      Playback speed
                    </p>
                    <p className="text-white text-xl font-extrabold mt-0.5 tabular-nums">
                      {Number.isInteger(playbackSpeed)
                        ? playbackSpeed.toFixed(1)
                        : playbackSpeed}
                      x
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleChangeSpeed(playbackSpeed - 0.05)}
                      className="w-9 h-9 rounded-full bg-[#262626] hover:bg-[#333333] text-white flex items-center justify-center cursor-pointer">
                      <Minus size={18} />
                    </button>
                    <input
                      type="range"
                      min={0.25}
                      max={2.0}
                      step={0.05}
                      value={playbackSpeed}
                      onChange={e =>
                        handleChangeSpeed(parseFloat(e.target.value))
                      }
                      className="flex-1 accent-white cursor-pointer"
                    />
                    <button
                      onClick={() => handleChangeSpeed(playbackSpeed + 0.05)}
                      className="w-9 h-9 rounded-full bg-[#262626] hover:bg-[#333333] text-white flex items-center justify-center cursor-pointer">
                      <Plus size={18} />
                    </button>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2">
                    {PLAYBACK_SPEEDS.map(s => {
                      const active = Math.abs(playbackSpeed - s) < 0.01;
                      return (
                        <button
                          key={s}
                          onClick={() => handleChangeSpeed(s)}
                          className="min-w-[64px] px-3 py-2 rounded-[18px] text-center cursor-pointer"
                          style={{
                            backgroundColor: active ? '#444444' : '#262626',
                          }}>
                          <p
                            className="text-xs font-bold"
                            style={{
                              color: active ? colors.primary : '#ffffff',
                            }}>
                            {Number.isInteger(s) ? s.toFixed(1) : s}x
                          </p>
                          {s === 1 && (
                            <p className="text-[10px] text-[#bbbbbb]">Normal</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: SLEEP TIMER (Exact Vega PlayerSleepControl) */}
              {activeTab === 'sleep' && (
                <div className="space-y-4 py-2 px-2">
                  <div className="text-center">
                    <p className="text-white text-sm font-bold">Sleep timer</p>
                    <p className="text-white text-xl font-extrabold mt-0.5 tabular-nums">
                      {sleepOption === 'off'
                        ? 'Off'
                        : sleepOption === 'episode'
                          ? 'End of episode'
                          : `${sleepMinutesLeft ?? sleepOption} min left`}
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => {
                        const cur =
                          typeof sleepOption === 'number' ? sleepOption : 0;
                        const next = Math.max(0, cur - 5);
                        setSleepOption(next === 0 ? 'off' : next);
                      }}
                      className="w-9 h-9 rounded-full bg-[#262626] text-white flex items-center justify-center cursor-pointer">
                      <Minus size={18} />
                    </button>
                    <span className="text-xs text-[#bbbbbb]">
                      Adjust by 5 minutes
                    </span>
                    <button
                      onClick={() => {
                        const cur =
                          typeof sleepOption === 'number' ? sleepOption : 0;
                        const next = Math.min(180, cur + 5);
                        setSleepOption(next);
                      }}
                      className="w-9 h-9 rounded-full bg-[#262626] text-white flex items-center justify-center cursor-pointer">
                      <Plus size={18} />
                    </button>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2">
                    {SLEEP_PRESETS.map(opt => {
                      const selected = sleepOption === opt;
                      const label =
                        opt === 'off'
                          ? 'Off'
                          : opt === 'episode'
                            ? 'End of episode'
                            : `${opt} min`;
                      return (
                        <button
                          key={String(opt)}
                          onClick={() => {
                            setSleepOption(opt);
                            setSettingsOpen(false);
                            showToast(`Sleep timer: ${label}`);
                          }}
                          className="min-w-[72px] px-3.5 py-2 rounded-[18px] text-xs font-bold cursor-pointer"
                          style={{
                            backgroundColor: selected ? '#444444' : '#262626',
                            color: selected ? colors.primary : '#ffffff',
                          }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 6: EXTERNAL PLAYER & DIRECT DOWNLOAD (VLC / MX Player / Outplayer / Copy Link) */}
              {activeTab === 'external' && (
                <div className="space-y-3 py-1">
                  <h4 className="text-center text-white text-base font-extrabold">
                    External Player & Stream Link
                  </h4>
                  <p className="text-xs text-center text-white/60">
                    Open the resolved stream directly in VLC, MX Player, Outplayer, IINA, or download it.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <a
                      href={`vlc://${absoluteDirectStreamUrl}`}
                      className="p-3 rounded-2xl bg-[#222222] hover:bg-[#2e2e2e] border border-[#333333] flex items-center gap-3 text-white">
                      <ExternalLink size={18} style={{color: colors.primary}} />
                      <div>
                        <p className="text-sm font-bold">Open in VLC Player</p>
                        <p className="text-[11px] text-white/60">
                          Android, iOS, macOS, Windows
                        </p>
                      </div>
                    </a>

                    <a
                      href={`intent:${absoluteDirectStreamUrl}#Intent;package=com.mxtech.videoplayer.ad;S.title=${encodeURIComponent(
                        routeParams.primaryTitle || 'Video',
                      )};end`}
                      className="p-3 rounded-2xl bg-[#222222] hover:bg-[#2e2e2e] border border-[#333333] flex items-center gap-3 text-white">
                      <ExternalLink size={18} style={{color: colors.primary}} />
                      <div>
                        <p className="text-sm font-bold">Open in MX Player</p>
                        <p className="text-[11px] text-white/60">
                          Android hardware/software player
                        </p>
                      </div>
                    </a>

                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          selectedStream.link || absoluteDirectStreamUrl,
                        );
                        showToast('Stream URL copied to clipboard');
                      }}
                      className="p-3 rounded-2xl bg-[#222222] hover:bg-[#2e2e2e] border border-[#333333] flex items-center gap-3 text-white text-left cursor-pointer">
                      <Copy size={18} style={{color: colors.primary}} />
                      <div>
                        <p className="text-sm font-bold">Copy Direct Stream URL</p>
                        <p className="text-[11px] text-white/60 truncate max-w-[200px]">
                          {selectedStream.server || 'Current server'}
                        </p>
                      </div>
                    </button>

                    <a
                      href={`/api/stream-proxy?url=${encodeURIComponent(
                        selectedStream.link,
                      )}${
                        encodedStreamHeaders
                          ? `&headers=${encodeURIComponent(encodedStreamHeaders)}`
                          : ''
                      }&download=1`}
                      download={`${routeParams.primaryTitle || 'video'}.mkv`}
                      className="p-3 rounded-2xl bg-[#222222] hover:bg-[#2e2e2e] border border-[#333333] flex items-center gap-3 text-white">
                      <Download size={18} style={{color: colors.primary}} />
                      <div>
                        <p className="text-sm font-bold">Direct Browser Download</p>
                        <p className="text-[11px] text-white/60">
                          Save video file to device
                        </p>
                      </div>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== VEGA EPISODE DRAWER ==================== */}
      {episodeDrawerOpen && routeParams.linkList && (
        <div
          onClick={() => setEpisodeDrawerOpen(false)}
          className="fixed inset-0 z-50 bg-black/65 flex justify-end">
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm h-full p-5 border-l flex flex-col"
            style={{
              backgroundColor: '#171717',
              borderColor: '#2e2e2e',
            }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Episodes</h3>
                <p className="text-xs text-white/60">
                  {routeParams.seasonTitle || routeParams.primaryTitle} (
                  {routeParams.linkList.length})
                </p>
              </div>
              <button
                onClick={() => setEpisodeDrawerOpen(false)}
                className="p-1.5 rounded-full bg-[#292929] text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {routeParams.linkList.map((ep, idx) => {
                const active = idx === episodeIndex;
                return (
                  <button
                    key={`${ep.link}-${idx}`}
                    onClick={() => {
                      setEpisodeIndex(idx);
                      setEpisodeDrawerOpen(false);
                    }}
                    className="w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-2 cursor-pointer"
                    style={{
                      backgroundColor: active ? '#303030' : '#222222',
                      borderColor: active ? colors.primary : '#303030',
                    }}>
                    <span
                      className="text-sm font-semibold truncate"
                      style={{
                        color: active ? colors.primary : '#ffffff',
                      }}>
                      {ep.title || `Episode ${idx + 1}`}
                    </span>
                    {active && <Play size={14} fill="currentColor" style={{color: colors.primary}} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
