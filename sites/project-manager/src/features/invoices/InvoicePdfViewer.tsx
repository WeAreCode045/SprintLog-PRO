import { useEffect, useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Trans, useLingui } from '@lingui/react/macro';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { getInvoicePdfUrl } from './api';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

/** Loads an invoice PDF from the Appwrite storage bucket via `storage.getFileView`,
 * fetching with session credentials so bucket permissions are honored. */
export function InvoicePdfViewer({ fileId }: { fileId: string }) {
  const { t } = useLingui();
  const viewUrl = useMemo(() => getInvoicePdfUrl(fileId), [fileId]);
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setFileData(null);
    setNumPages(0);

    void (async () => {
      try {
        const response = await fetch(viewUrl, { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        if (!cancelled) setFileData(buffer);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [viewUrl]);

  if (failed) {
    return (
      <div className="invoice-pdf-fallback">
        <p className="empty-state"><Trans>PDF kon niet worden weergegeven.</Trans></p>
        <a className="btn-accent" href={viewUrl} target="_blank" rel="noreferrer">
          <Trans>PDF openen in nieuw tabblad</Trans>
        </a>
      </div>
    );
  }

  if (!fileData) {
    return <p className="empty-state">{t`PDF laden…`}</p>;
  }

  return (
    <div className="invoice-pdf-viewer">
      <Document
        file={fileData}
        onLoadSuccess={({ numPages: loaded }) => setNumPages(loaded)}
        onLoadError={() => setFailed(true)}
        loading={<p className="empty-state">{t`PDF laden…`}</p>}
        noData={<p className="empty-state">{t`PDF laden…`}</p>}
      >
        {Array.from({ length: numPages }, (_, index) => (
          <Page
            key={index}
            pageNumber={index + 1}
            width={900}
            className="invoice-pdf-page"
            renderAnnotationLayer={false}
          />
        ))}
      </Document>
    </div>
  );
}
