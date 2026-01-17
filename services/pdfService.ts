/**
 * PDF Parsing Service
 * Uses PDF.js (pdfjs-dist) to extract text from PDF files
 */

import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

// Initialize the worker
const worker = new PdfWorker();
pdfjsLib.GlobalWorkerOptions.workerPort = worker;

export interface PDFParseResult {
  text: string;
  pageCount: number;
  pageTexts: string[];  // Text for each page separately
  metadata?: {
    title?: string;
    author?: string;
  };
}

/**
 * Extract text from a single page
 */
async function extractPageText(page: pdfjsLib.PDFPageProxy): Promise<string> {
  const textContent = await page.getTextContent();
  
  let lastY: number | null = null;
  const pageText: string[] = [];
  
  for (const item of textContent.items) {
    if ('str' in item) {
      const transform = item.transform;
      const currentY = transform ? transform[5] : null;
      
      if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 5) {
        pageText.push('\n');
      }
      
      pageText.push(item.str);
      
      if (item.str && !item.str.endsWith(' ') && !item.str.endsWith('\n')) {
        pageText.push(' ');
      }
      
      lastY = currentY;
    }
  }
  
  return pageText.join('').trim();
}

/**
 * Extract text content from a PDF file
 */
export async function parsePDF(file: File): Promise<PDFParseResult> {
  console.log('parsePDF: Starting to parse', file.name, 'size:', file.size);
  
  const arrayBuffer = await file.arrayBuffer();
  console.log('parsePDF: Got arrayBuffer, size:', arrayBuffer.byteLength);
  
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
  });
  
  console.log('parsePDF: Loading document...');
  const pdf = await loadingTask.promise;
  console.log('parsePDF: Document loaded, pages:', pdf.numPages);
  const pageCount = pdf.numPages;
  
  // Extract text from all pages
  const pageTexts: string[] = [];
  
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const text = await extractPageText(page);
    pageTexts.push(text);
  }
  
  // Try to get metadata
  let metadata: PDFParseResult['metadata'];
  try {
    const metadataObj = await pdf.getMetadata();
    const info = metadataObj.info as Record<string, unknown> | undefined;
    metadata = {
      title: info?.Title as string | undefined,
      author: info?.Author as string | undefined,
    };
  } catch {
    // Metadata extraction failed, continue without it
  }
  
  const fullText = pageTexts.join('\n\n--- Page Break ---\n\n');
  
  return {
    text: fullText,
    pageCount,
    pageTexts,
    metadata,
  };
}

/**
 * Extract text from a specific page range (1-indexed, inclusive)
 */
export function getTextForPageRange(
  pageTexts: string[], 
  startPage: number, 
  endPage: number
): string {
  // Convert 1-indexed to 0-indexed
  const start = Math.max(0, startPage - 1);
  const end = Math.min(pageTexts.length, endPage);
  
  return pageTexts.slice(start, end).join('\n\n');
}

/**
 * Get the first N pages of text (for TOC extraction)
 */
export function getFirstPagesText(pageTexts: string[], numPages: number = 50): string {
  return pageTexts.slice(0, numPages).join('\n\n--- Page Break ---\n\n');
}

/**
 * Check if a file is a PDF
 */
export function isPDFFile(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}
