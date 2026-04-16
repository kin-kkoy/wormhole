import { Store } from '@tauri-apps/plugin-store';

let instance: Store | null = null;

export async function getSettingsStore(): Promise<Store> {
  if (!instance) {
    instance = await Store.load('settings.json');
  }
  return instance;
}
