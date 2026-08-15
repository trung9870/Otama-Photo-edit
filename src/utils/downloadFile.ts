import { saveAs } from 'file-saver';

/** Download remote generated media without navigating away from the app. */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const source = /^https?:\/\//i.test(url)
    ? `/api/proxy-image?url=${encodeURIComponent(url)}`
    : url;
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Không tải được file (${response.status}).`);
  saveAs(await response.blob(), filename);
}
