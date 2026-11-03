import React, {useState, useEffect} from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  KeyRound,
  LogIn,
  Sparkles,
} from 'lucide-react';
import {useM3Colors} from '../theme/M3PaletteContext';
import {useWebViewModalStore} from '../lib/zustand/webViewModalStore';
import {proxyFetch} from '../lib/sandbox/sandboxRuntime';

export const WebViewModal: React.FC = () => {
  const colors = useM3Colors();
  const {activeRequest, closeModal} = useWebViewModalStore();

  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState<string>(
    'Waiting for device code approval...',
  );

  const deviceCode = activeRequest?.deviceCode || '';
  const isKartoons = Boolean(
    activeRequest?.url?.includes('kartoons.to') || deviceCode,
  );

  // Automatically poll Kartoons device status while the modal is open
  useEffect(() => {
    if (!activeRequest || !deviceCode) return;

    let cancelled = false;
    setErrorMsg(null);
    setPollingStatus('Waiting for approval on kartoons.to...');

    const poll = async () => {
      while (!cancelled) {
        try {
          const statusUrl = `https://api.kartoons.to/api/cloudstream/device/status?code=${encodeURIComponent(
            deviceCode,
          )}`;
          const res = await proxyFetch(
            activeRequest.author || 'Zenda-Cross',
            statusUrl,
            {
              method: 'GET',
              headers: {
                Accept: 'application/json',
                Referer: 'https://kartoons.to/',
                Origin: 'https://kartoons.to',
              },
            },
          );
          if (!cancelled && res.status === 200 && res.bodyText) {
            const parsed = JSON.parse(res.bodyText);
            const data = parsed?.data || parsed;
            if (
              data?.status === 'linked' &&
              typeof data?.token === 'string' &&
              data.token.trim()
            ) {
              setPollingStatus('Device linked! Connecting...');
              const resolveFn = activeRequest.onResolve;
              closeModal();
              resolveFn({
                code: deviceCode,
                token: data.token.trim(),
              });
              return;
            }
          }
        } catch {
          // Continue polling
        }
        await new Promise(r => setTimeout(r, 2500));
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [activeRequest, deviceCode, closeModal]);

  if (!activeRequest) return null;

  const handleCopyCode = () => {
    if (!deviceCode) return;
    navigator.clipboard?.writeText(deviceCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDirectLoginAndLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !deviceCode) return;

    setSigningIn(true);
    setErrorMsg(null);
    try {
      const author = activeRequest.author || 'Zenda-Cross';
      const formBody = new URLSearchParams();
      formBody.append('username', username.trim());
      formBody.append('password', password);

      const loginRes = await proxyFetch(
        author,
        'https://api.kartoons.to/api/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            Referer: 'https://kartoons.to/',
            Origin: 'https://kartoons.to',
          },
          body: formBody.toString(),
        },
      );

      let loginData: any = null;
      try {
        loginData = JSON.parse(loginRes.bodyText);
      } catch {
        loginData = null;
      }

      const accessToken =
        loginData?.data?.access_token || loginData?.access_token;
      if (!accessToken) {
        throw new Error(
          loginData?.message ||
            'Invalid username or password, or please use the "Open kartoons.to" button below.',
        );
      }

      const linkRes = await proxyFetch(
        author,
        'https://api.kartoons.to/api/cloudstream/device/link',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
            Referer: 'https://kartoons.to/',
            Origin: 'https://kartoons.to',
          },
          body: JSON.stringify({
            code: deviceCode,
            token: accessToken,
          }),
        },
      );

      let linkData: any = null;
      try {
        linkData = JSON.parse(linkRes.bodyText);
      } catch {
        linkData = null;
      }

      if (linkRes.status >= 400 || linkData?.success === false) {
        throw new Error(
          linkData?.message || 'Failed to approve device code on Kartoons.',
        );
      }

      // Fetch the linked cloudstream token from /device/status
      const statusRes = await proxyFetch(
        author,
        `https://api.kartoons.to/api/cloudstream/device/status?code=${encodeURIComponent(
          deviceCode,
        )}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Referer: 'https://kartoons.to/',
            Origin: 'https://kartoons.to',
          },
        },
      );
      const statusJson = JSON.parse(statusRes.bodyText || '{}');
      const statusData = statusJson?.data || statusJson;
      const finalToken = statusData?.token || accessToken;

      const resolveFn = activeRequest.onResolve;
      closeModal();
      resolveFn({
        code: deviceCode,
        token: String(finalToken).trim(),
      });
    } catch (err: any) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Could not sign in directly. Use the Open kartoons.to button below.',
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleContinueAsGuest = () => {
    const resolveFn = activeRequest.onResolve;
    closeModal();
    resolveFn({
      code: deviceCode || 'GUEST1',
      token: `vega_guest_${deviceCode || 'GUEST1'}`,
      guestMode: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div
        className="w-full max-w-md rounded-3xl border p-5 shadow-2xl overflow-hidden"
        style={{
          backgroundColor: colors.surfaceContainerHigh,
          borderColor: colors.outlineVariant,
          color: colors.onSurface,
        }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: colors.primary,
                color: colors.onPrimary,
              }}>
              <KeyRound size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">
                {activeRequest.title || 'Link Account'}
              </h2>
              <p
                className="text-xs mt-0.5"
                style={{color: colors.onSurfaceVariant}}>
                {isKartoons
                  ? 'Device-code approval or instant guest browse'
                  : 'Provider authentication'}
              </p>
            </div>
          </div>

          <button
            onClick={handleContinueAsGuest}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            style={{color: colors.onSurfaceVariant}}
            title="Continue without linking">
            <X size={18} />
          </button>
        </div>

        {activeRequest.description && (
          <p
            className="text-xs leading-relaxed mb-4"
            style={{color: colors.onSurfaceVariant}}>
            {activeRequest.description}
          </p>
        )}

        {/* Device Code Box */}
        {deviceCode && (
          <div
            className="rounded-2xl border p-3.5 mb-4 flex items-center justify-between gap-3"
            style={{
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            }}>
            <div>
              <div
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{color: colors.onSurfaceVariant}}>
                Device Approval Code
              </div>
              <div
                className="text-2xl font-black tracking-[0.25em] font-mono mt-0.5"
                style={{color: colors.primary}}>
                {deviceCode}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:opacity-90"
                style={{
                  backgroundColor: colors.surfaceContainerHigh,
                  borderColor: colors.outlineVariant,
                  color: colors.onSurface,
                }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <a
                href={activeRequest.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:opacity-90 no-underline"
                style={{
                  backgroundColor: colors.primary,
                  color: colors.onPrimary,
                }}>
                <span>Open Site</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        )}

        {/* Direct Kartoons Login Form */}
        {isKartoons && (
          <form onSubmit={handleDirectLoginAndLink} className="space-y-2.5 mb-4">
            <div
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{color: colors.onSurfaceVariant}}>
              Or Sign In Directly to Approve Code {deviceCode}
            </div>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Kartoons Username or Email"
              className="w-full px-3.5 py-2.5 rounded-xl border text-xs outline-none"
              style={{
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
                color: colors.onSurface,
              }}
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-3.5 py-2.5 rounded-xl border text-xs outline-none"
              style={{
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
                color: colors.onSurface,
              }}
            />
            {errorMsg && (
              <p className="text-xs text-red-400 leading-snug">{errorMsg}</p>
            )}
            <button
              type="submit"
              disabled={signingIn || !username.trim() || !password.trim()}
              className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              style={{
                backgroundColor: colors.primary,
                color: colors.onPrimary,
              }}>
              {signingIn ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <LogIn size={15} />
              )}
              <span>
                {signingIn
                  ? 'Signing in & linking...'
                  : `Sign In & Approve Code ${deviceCode}`}
              </span>
            </button>
          </form>
        )}

        {/* Live Polling Indicator */}
        {deviceCode && (
          <div
            className="flex items-center gap-2 text-xs mb-4 px-1"
            style={{color: colors.onSurfaceVariant}}>
            <Loader2
              size={14}
              className="animate-spin shrink-0"
              style={{color: colors.primary}}
            />
            <span>{pollingStatus}</span>
          </div>
        )}

        {/* Guest Mode Fallback Button */}
        <button
          type="button"
          onClick={handleContinueAsGuest}
          className="w-full py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-white/5 transition-colors"
          style={{
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.outlineVariant,
            color: colors.onSurface,
          }}>
          <Sparkles size={14} style={{color: colors.primary}} />
          <span>Continue in Guest Mode (Browse Without Login)</span>
        </button>
      </div>
    </div>
  );
};
