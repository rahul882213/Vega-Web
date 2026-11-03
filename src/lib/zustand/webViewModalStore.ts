import {create} from 'zustand';

export interface WebViewModalRequest {
  url: string;
  title?: string;
  description?: string;
  deviceCode?: string;
  author?: string;
  onResolve: (payload: {
    token?: string;
    code?: string;
    guestMode?: boolean;
    cancelled?: boolean;
  }) => void;
}

interface WebViewModalState {
  activeRequest: WebViewModalRequest | null;
  openModal: (req: WebViewModalRequest) => void;
  closeModal: () => void;
}

export const useWebViewModalStore = create<WebViewModalState>(set => ({
  activeRequest: null,
  openModal: req => set({activeRequest: req}),
  closeModal: () => set({activeRequest: null}),
}));
