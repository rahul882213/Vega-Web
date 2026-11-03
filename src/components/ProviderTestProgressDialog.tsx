import React from 'react';
import {CheckCircle2, XCircle, Loader2, Circle} from 'lucide-react';
import {useM3Colors} from '../theme/M3PaletteContext';
import {
  DiagnosticProgressEvent,
  DiagnosticStageName,
} from '../lib/services/providerDiagnostics';

const STAGE_ORDER: DiagnosticStageName[] = [
  'Catalog',
  'Show list (posts)',
  'Metadata',
  'Playback (episodes/directLinks)',
  'Streams',
];

interface ProviderTestProgressDialogProps {
  visible: boolean;
  providerName?: string;
  events: Record<string, DiagnosticProgressEvent>;
  onCancel: () => void;
}

export const ProviderTestProgressDialog: React.FC<
  ProviderTestProgressDialogProps
> = ({visible, providerName, events, onCancel}) => {
  const colors = useM3Colors();

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{backgroundColor: 'rgba(0,0,0,0.75)'}}>
      <div
        className="w-full max-w-md rounded-3xl p-6 border shadow-2xl"
        style={{
          backgroundColor: colors.surfaceContainerHigh,
          borderColor: colors.outlineVariant,
        }}>
        <h3
          className="text-lg font-bold mb-1"
          style={{color: colors.onSurface}}>
          Testing {providerName || 'Provider'}
        </h3>
        <p
          className="text-xs mb-5"
          style={{color: colors.onSurfaceVariant}}>
          Verifying real provider modules and live content pipeline...
        </p>

        <div className="space-y-3 mb-6">
          {STAGE_ORDER.map((stageName, idx) => {
            const ev = events[stageName];
            const status = ev?.status;
            return (
              <div
                key={stageName}
                className="flex items-start gap-3 p-2.5 rounded-xl border"
                style={{
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                }}>
                <div className="mt-0.5 shrink-0">
                  {status === 'pass' ? (
                    <CheckCircle2 size={18} className="text-emerald-400" />
                  ) : status === 'fail' ? (
                    <XCircle size={18} style={{color: colors.error}} />
                  ) : status === 'running' ? (
                    <Loader2
                      size={18}
                      className="animate-spin"
                      style={{color: colors.primary}}
                    />
                  ) : (
                    <Circle
                      size={18}
                      className="opacity-30"
                      style={{color: colors.onSurfaceVariant}}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-xs font-semibold"
                      style={{color: colors.onSurface}}>
                      {idx + 1}. {stageName}
                    </span>
                    {status && (
                      <span
                        className="text-[10px] font-bold uppercase"
                        style={{
                          color:
                            status === 'pass'
                              ? '#34D399'
                              : status === 'fail'
                                ? colors.error
                                : colors.primary,
                        }}>
                        {status}
                      </span>
                    )}
                  </div>
                  {ev?.detail && (
                    <p
                      className="text-[11px] truncate mt-0.5"
                      style={{color: colors.onSurfaceVariant}}>
                      {ev.detail}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="px-5 py-2 rounded-full text-xs font-semibold cursor-pointer"
            style={{
              backgroundColor: colors.errorContainer,
              color: colors.onErrorContainer,
            }}>
            Cancel Test
          </button>
        </div>
      </div>
    </div>
  );
};
