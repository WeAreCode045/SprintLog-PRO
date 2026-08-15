import { useParams } from 'react-router-dom';
import { InvoiceForm } from '../features/invoices/InvoiceForm';

export function InvoiceFormPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  return <InvoiceForm invoiceId={invoiceId} />;
}
