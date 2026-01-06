/**
 * IBM Plex Sans Font Embedding for jsPDF
 * 
 * This module loads IBM Plex Sans fonts from local TTF files
 * and registers them for use in PDF generation with jsPDF.
 * No runtime network fetch required - fonts are bundled with the app.
 */

// Import TTF files as URLs (Vite handles this with ?url suffix)
import IBMPlexSansRegularUrl from '@/assets/fonts/IBMPlexSans-Regular.ttf?url';
import IBMPlexSansBoldUrl from '@/assets/fonts/IBMPlexSans-Bold.ttf?url';

// Cache for loaded fonts
let fontsLoaded = false;
let fontCache: { regular?: string; bold?: string } = {};

/**
 * Converts an ArrayBuffer to a base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Fetches a local font file and converts it to base64
 */
async function fetchLocalFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load font: ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  return arrayBufferToBase64(buffer);
}

/**
 * Loads IBM Plex Sans fonts from local assets and caches them
 */
export async function loadIBMPlexSansFonts(): Promise<{ regular: string; bold: string }> {
  if (fontsLoaded && fontCache.regular && fontCache.bold) {
    return { regular: fontCache.regular, bold: fontCache.bold };
  }

  try {
    const [regular, bold] = await Promise.all([
      fetchLocalFontAsBase64(IBMPlexSansRegularUrl),
      fetchLocalFontAsBase64(IBMPlexSansBoldUrl),
    ]);

    fontCache = { regular, bold };
    fontsLoaded = true;

    return { regular, bold };
  } catch (error) {
    console.error('Failed to load IBM Plex Sans fonts:', error);
    throw error;
  }
}

/**
 * Registers IBM Plex Sans fonts with a jsPDF document
 */
export async function registerIBMPlexSans(doc: any): Promise<void> {
  try {
    const fonts = await loadIBMPlexSansFonts();

    // Add regular weight
    doc.addFileToVFS('IBMPlexSans-Regular.ttf', fonts.regular);
    doc.addFont('IBMPlexSans-Regular.ttf', 'IBMPlexSans', 'normal');

    // Add bold weight
    doc.addFileToVFS('IBMPlexSans-Bold.ttf', fonts.bold);
    doc.addFont('IBMPlexSans-Bold.ttf', 'IBMPlexSans', 'bold');

    console.log('IBM Plex Sans fonts registered successfully');
  } catch (error) {
    console.warn('Failed to register IBM Plex Sans, falling back to Helvetica:', error);
    // Silently fall back to helvetica
  }
}

/**
 * Sets the font to IBM Plex Sans if available, otherwise falls back to Helvetica
 */
export function setIBMPlexSans(doc: any, style: 'normal' | 'bold' = 'normal'): void {
  const list = typeof doc?.getFontList === 'function' ? doc.getFontList() : undefined;
  const hasIBM = !!(list && (list as any).IBMPlexSans && (list as any).IBMPlexSans.includes(style));

  if (hasIBM) {
    doc.setFont('IBMPlexSans', style);
    return;
  }

  // Fallback (and avoid jsPDF "Unable to look up font label" warnings)
  doc.setFont('helvetica', style === 'bold' ? 'bold' : 'normal');
}
