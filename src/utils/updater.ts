import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { version } from '../../package.json';

export const CURRENT_VERSION = `v${version.split('.').slice(0, 2).join('.')}`;

const RELEASES_API = 'https://api.github.com/repos/devops-dude-dinodam/stoke-wind/releases/latest';

export interface UpdateInfo {
  available: boolean;
  latestVersion: string;
  downloadUrl: string | null;
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const res = await fetch(RELEASES_API, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json();

  const latestVersion: string = data.tag_name ?? '';
  const asset = (data.assets as any[])?.find((a: any) =>
    typeof a.browser_download_url === 'string' && a.browser_download_url.endsWith('.apk'),
  );

  return {
    available: latestVersion !== CURRENT_VERSION && latestVersion !== '',
    latestVersion,
    downloadUrl: asset?.browser_download_url ?? null,
  };
}

export async function downloadAndInstall(
  downloadUrl: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  const dest = FileSystem.cacheDirectory + 'stoke-update.apk';

  const download = FileSystem.createDownloadResumable(
    downloadUrl,
    dest,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      if (totalBytesExpectedToWrite > 0) {
        onProgress(Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100));
      }
    },
  );

  const result = await download.downloadAsync();
  if (!result?.uri) throw new Error('Download failed');

  // Convert file:// URI to content:// URI required by the install intent on Android 7+
  const contentUri = await FileSystem.getContentUriAsync(result.uri);

  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1,   // FLAG_GRANT_READ_URI_PERMISSION
    type: 'application/vnd.android.package-archive',
  });
}
