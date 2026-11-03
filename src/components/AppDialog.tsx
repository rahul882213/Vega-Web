import React from 'react';
import useAppDialogStore from '../lib/zustand/appDialogStore';
import {useM3Colors} from '../theme/M3PaletteContext';
import {CheckCircle2, AlertTriangle, XCircle, Info} from 'lucide-react';

export const GlobalAppDialogHost: React.FC = () => {
  const {dialog, dismissDialog} = useAppDialogStore();
  const colors = useM3Colors();

  if (!dialog) return null;

  const actions =
    dialog.actions && dialog.actions.length > 0
      ? dialog.actions
      : [{label: 'OK', variant: 'primary' as const}];

  const renderIcon = () => {
    if (dialog.variant === 'success') {
      return <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />;
    }
    if (dialog.variant === 'warning') {
      return <AlertTriangle size={24} className="text-amber-400 shrink-0" />;
    }
    if (dialog.variant === 'error') {
      return <XCircle size={24} style={{color: colors.error}} className="shrink-0" />;
    }
    return <Info size={24} style={{color: colors.primary}} className="shrink-0" />;
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{backgroundColor: 'rgba(0,0,0,0.72)'}}
      onClick={dismissDialog}>
      <div
        className="w-full max-w-md rounded-[28px] p-6 shadow-2xl border"
        style={{
          backgroundColor: colors.surfaceContainerHigh,
          borderColor: colors.outlineVariant,
        }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3.5 mb-3">
          {renderIcon()}
          <h3
            className="text-lg font-semibold leading-snug"
            style={{color: colors.onSurface}}>
            {dialog.title}
          </h3>
        </div>
        <p
          className="text-sm leading-relaxed whitespace-pre-wrap mb-6"
          style={{color: colors.onSurfaceVariant}}>
          {dialog.message}
        </p>
        <div className="flex items-center justify-end gap-2.5">
          {actions.map((action, idx) => {
            const isPrimary =
              action.variant === 'primary' ||
              (!action.variant && idx === actions.length - 1);
            const isDestructive = action.variant === 'destructive';
            return (
              <button
                key={idx}
                onClick={() => {
                  dismissDialog();
                  action.onPress?.();
                }}
                className="px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 cursor-pointer"
                style={{
                  backgroundColor: isDestructive
                    ? colors.errorContainer
                    : isPrimary
                      ? colors.primary
                      : 'transparent',
                  color: isDestructive
                    ? colors.onErrorContainer
                    : isPrimary
                      ? colors.onPrimary
                      : colors.primary,
                }}>
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
