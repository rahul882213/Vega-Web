import {create} from 'zustand';

export type AppDialogVariant = 'default' | 'success' | 'warning' | 'error';

export interface AppDialogAction {
  label: string;
  variant?: 'primary' | 'secondary' | 'destructive';
  onPress?: () => void;
}

export interface GlobalAppDialog {
  title: string;
  message: string;
  messageFormat?: 'plain' | 'markdown';
  variant?: AppDialogVariant;
  actions?: AppDialogAction[];
}

interface AppDialogState {
  dialog?: GlobalAppDialog;
  showDialog: (dialog: GlobalAppDialog) => void;
  dismissDialog: () => void;
}

const useAppDialogStore = create<AppDialogState>(set => ({
  dialog: undefined,
  showDialog: dialog => set({dialog}),
  dismissDialog: () => set({dialog: undefined}),
}));

export const showAppDialog = (dialog: GlobalAppDialog) => {
  useAppDialogStore.getState().showDialog(dialog);
};

export default useAppDialogStore;
