export const VEGA_SUPPORTED_PROVIDER_VERSION = 1;

export interface ProviderModuleValidation {
  valid: boolean;
  providerVersion?: number | string;
  reason?: string;
}

const PROVIDER_MARKER = /^\s*\/\/\s*@vega-provider(?:\s|$)/m;
const VERSION_HEADER = /^\s*\/\/\s*@vega-version\s+(\S+)\s*$/m;
const HEADER_WINDOW = 512;

export function validateProviderModule(
  code: unknown,
  moduleName: string,
): ProviderModuleValidation {
  if (typeof code !== 'string' || code.trim().length === 0) {
    return {valid: false, reason: `Missing ${moduleName}.js`};
  }

  const header = code.slice(0, HEADER_WINDOW);

  if (!PROVIDER_MARKER.test(header)) {
    return {valid: true, providerVersion: VEGA_SUPPORTED_PROVIDER_VERSION};
  }

  const match = header.match(VERSION_HEADER);
  if (!match) {
    return {valid: true, providerVersion: VEGA_SUPPORTED_PROVIDER_VERSION};
  }

  const rawVersion = match[1].trim().replace(/^v/i, '');
  const numericVersion = parseFloat(rawVersion);
  if (Number.isNaN(numericVersion) || numericVersion <= 0) {
    return {
      valid: false,
      reason: `Invalid @vega-version "${match[1]}" in ${moduleName}.js`,
    };
  }

  return {valid: true, providerVersion: numericVersion};
}
