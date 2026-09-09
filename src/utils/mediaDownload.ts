export async function downloadMediaDirect(url: string, filename: string) {
  if (!url) throw new Error('Arquivo indisponível para download.');

  const response = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit' });
  if (!response.ok) throw new Error(`Falha ao baixar arquivo (${response.status}).`);

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename || 'ia-connect-media';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function safeDownloadName(name: string | undefined, type: 'IMAGE' | 'VIDEO' = 'IMAGE') {
  const fallback = type === 'VIDEO' ? 'video-ia-connect.mp4' : 'imagem-ia-connect.png';
  if (!name?.trim()) return fallback;
  const clean = name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  if (/\.[a-zA-Z0-9]{2,5}$/.test(clean)) return clean;
  return `${clean}.${type === 'VIDEO' ? 'mp4' : 'png'}`;
}
