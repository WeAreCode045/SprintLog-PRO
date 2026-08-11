import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { useLingui } from '@lingui/react/macro';
import type { InvoiceSettingsRow } from '../../appwrite/types';

/** Just the editable template fields — no RowMeta ($id/$createdAt/…), since the live preview
 * renders from in-progress form state that was never saved as a row. */
export type InvoiceTemplateFields = Pick<
  InvoiceSettingsRow,
  | 'senderName'
  | 'senderAddress'
  | 'senderPostalCode'
  | 'senderCity'
  | 'senderCountry'
  | 'senderVatNumber'
  | 'senderRegistrationNumber'
  | 'contactPerson'
  | 'contactPhone'
  | 'contactEmail'
  | 'contactWebsite'
  | 'bankName'
  | 'bankIban'
  | 'bankSwiftBic'
  | 'vatEnabled'
  | 'vatRate'
  | 'vatLabel'
  | 'paymentTermDays'
  | 'currency'
  | 'footerText'
  | 'defaultInstructionsText'
>;

const BRAND_COLOR = '#f4622c';
const MUTED_COLOR = '#666666';
const BORDER_COLOR = '#dddddd';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9.5, fontFamily: 'Helvetica', color: '#1a1a1a' },
  title: { fontSize: 28, fontWeight: 700, color: BRAND_COLOR, marginBottom: 20 },
  partiesRow: { flexDirection: 'row', marginBottom: 20 },
  partyCol: { flex: 1 },
  partyLabel: { fontSize: 8, fontWeight: 700, marginBottom: 3, textTransform: 'uppercase' },
  partyName: { fontSize: 10, fontWeight: 700, marginBottom: 2 },
  partyLine: { fontSize: 9, color: MUTED_COLOR, marginBottom: 1 },
  metaRow: { flexDirection: 'row', marginBottom: 16, paddingBottom: 12, borderBottom: `1 solid ${BORDER_COLOR}` },
  metaCol: { flex: 1 },
  metaLabel: { fontSize: 8, fontWeight: 700, marginBottom: 3 },
  metaValue: { fontSize: 9 },
  metaValueDue: { fontSize: 9, fontWeight: 700 },
  instructions: { marginBottom: 16 },
  instructionsText: { fontSize: 9, color: MUTED_COLOR },
  table: { marginTop: 4 },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: BRAND_COLOR,
    color: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontWeight: 700,
    fontSize: 9,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottom: `1 solid ${BORDER_COLOR}`,
  },
  colTask: { flex: 3 },
  colDates: { flex: 3 },
  colHours: { flex: 1, textAlign: 'right' },
  colRate: { flex: 1.2, textAlign: 'right' },
  colTotal: { flex: 1.2, textAlign: 'right' },
  totals: { marginTop: 16, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', width: 220, paddingVertical: 3 },
  totalRowFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 220,
    paddingTop: 8,
    marginTop: 4,
    borderTop: `1 solid ${BRAND_COLOR}`,
    fontWeight: 700,
    fontSize: 11,
    color: BRAND_COLOR,
  },
  footerNote: { marginTop: 24, fontSize: 8.5, color: MUTED_COLOR },
  footer: {
    marginTop: 'auto',
    paddingTop: 12,
    borderTop: `2 solid ${BRAND_COLOR}`,
    flexDirection: 'row',
  },
  footerCol: { flex: 1, fontSize: 8 },
  footerColLabel: { fontWeight: 700, marginBottom: 3 },
  footerColLine: { color: MUTED_COLOR, marginBottom: 1 },
});

function formatHours(hours: number) {
  return hours.toFixed(2);
}

function formatCurrency(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(2)}`;
}

function formatDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}-${month}-${year}`;
}

/** Mirrors the replacement codes applied server-side in the generate-invoices/create-credit-
 * invoice functions, so the live preview shows exactly what admins will get in the real PDF. */
function applyPlaceholders(text: string | null | undefined, tokens: Record<string, string>) {
  if (!text) return text;
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : match,
  );
}

interface PreviewLine {
  taskId: string;
  taskTitle: string;
  hours: number;
  dates: string[];
}

/** Sample data — this is a template preview, not a real invoice. */
const SAMPLE_COMPANY = {
  name: 'Voorbeeld Klant BV',
  address: 'Voorbeeldstraat 10, 1000 Brussel',
  email: 'facturatie@voorbeeldklant.be',
  vatNumber: 'BE0987654321',
};

const SAMPLE_LINES: PreviewLine[] = [
  { taskId: '1', taskTitle: 'Website redesign', hours: 8, dates: ['2026-08-04', '2026-08-05'] },
  { taskId: '2', taskTitle: 'API integratie', hours: 4.5, dates: ['2026-08-06'] },
];

const SAMPLE_HOURLY_RATE = 85;

/** Live preview of the invoice template, driven by the current (unsaved) settings form state. */
export function InvoicePreviewDocument({ settings }: { settings: InvoiceTemplateFields }) {
  const { t } = useLingui();
  const s = settings;
  const currency = s.currency || 'EUR';
  const vatLabel = s.vatLabel || 'BTW';
  const vatEnabled = s.vatEnabled ?? true;
  const vatRate = vatEnabled ? (s.vatRate ?? 21) : 0;

  const totalHours = SAMPLE_LINES.reduce((sum, line) => sum + line.hours, 0);
  const totalAmount = Math.round(totalHours * SAMPLE_HOURLY_RATE * 100) / 100;
  const vatAmount = Math.round(totalAmount * vatRate) / 100;
  const totalWithVat = Math.round((totalAmount + vatAmount) * 100) / 100;

  const senderLines = [s.senderAddress, [s.senderPostalCode, s.senderCity].filter(Boolean).join(' '), s.senderCountry].filter(
    Boolean,
  );

  const dueDateIso = (() => {
    const due = new Date('2026-08-10T00:00:00Z');
    due.setUTCDate(due.getUTCDate() + (s.paymentTermDays ?? 30));
    return due.toISOString();
  })();

  const tokens = {
    invoiceNumber: 'INV-2026-0001',
    dueDate: formatDate(dueDateIso),
    totalAmount: formatCurrency(totalWithVat, currency),
    bankAccountNumber: s.bankIban || '',
    creditForInvoice: '',
  };
  const instructionsText = applyPlaceholders(s.defaultInstructionsText, tokens);
  const footerNoteText = applyPlaceholders(s.footerText, tokens);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{t`Factuur`}</Text>

        <View style={styles.partiesRow}>
          <View style={styles.partyCol}>
            <Text style={styles.partyLabel}>{t`Van`}</Text>
            <Text style={styles.partyName}>{s.senderName || t`Jouw bedrijfsnaam`}</Text>
            {senderLines.map((line, i) => (
              <Text style={styles.partyLine} key={i}>
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.partyCol}>
            <Text style={styles.partyLabel}>{t`Naar`}</Text>
            <Text style={styles.partyName}>{SAMPLE_COMPANY.name}</Text>
            <Text style={styles.partyLine}>{SAMPLE_COMPANY.address}</Text>
            <Text style={styles.partyLine}>{SAMPLE_COMPANY.email}</Text>
            <Text style={styles.partyLine}>{t`BTW`}: {SAMPLE_COMPANY.vatNumber}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>{t`Factuurnummer`}</Text>
            <Text style={styles.metaValue}>INV-2026-0001</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>{t`Factuurdatum`}</Text>
            <Text style={styles.metaValue}>10-08-2026</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>{t`Vervaldag`}</Text>
            <Text style={styles.metaValueDue}>{formatDate(dueDateIso)}</Text>
          </View>
        </View>

        {instructionsText ? (
          <View style={styles.instructions}>
            <Text style={styles.instructionsText}>{instructionsText}</Text>
          </View>
        ) : null}

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={styles.colDates}>{t`Datum`}</Text>
            <Text style={styles.colTask}>{t`Taak`}</Text>
            <Text style={styles.colHours}>{t`Uren`}</Text>
            <Text style={styles.colRate}>{t`Tarief`}</Text>
            <Text style={styles.colTotal}>{t`Totaal`}</Text>
          </View>
          {SAMPLE_LINES.map((line) => (
            <View style={styles.row} key={line.taskId}>
              <Text style={styles.colDates}>{line.dates.map(formatDate).join(', ')}</Text>
              <Text style={styles.colTask}>{line.taskTitle}</Text>
              <Text style={styles.colHours}>{formatHours(line.hours)}</Text>
              <Text style={styles.colRate}>{formatCurrency(SAMPLE_HOURLY_RATE, currency)}</Text>
              <Text style={styles.colTotal}>{formatCurrency(line.hours * SAMPLE_HOURLY_RATE, currency)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>{t`Bedrag excl. BTW`}</Text>
            <Text>{formatCurrency(totalAmount, currency)}</Text>
          </View>
          {vatEnabled ? (
            <View style={styles.totalRow}>
              <Text>
                {vatLabel} ({vatRate}%)
              </Text>
              <Text>{formatCurrency(vatAmount, currency)}</Text>
            </View>
          ) : null}
          <View style={styles.totalRowFinal}>
            <Text>{t`Totaalbedrag`}</Text>
            <Text>{formatCurrency(totalWithVat, currency)}</Text>
          </View>
        </View>

        {footerNoteText ? <Text style={styles.footerNote}>{footerNoteText}</Text> : null}

        <View style={styles.footer}>
          <View style={styles.footerCol}>
            <Text style={styles.footerColLabel}>{s.senderName || t`Bedrijfsnaam`}</Text>
            {s.contactPerson ? <Text style={styles.footerColLine}>{s.contactPerson}</Text> : null}
            {senderLines.map((line, i) => (
              <Text style={styles.footerColLine} key={i}>
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.footerCol}>
            <Text style={styles.footerColLabel}>{t`Contact informatie`}</Text>
            {s.contactPhone ? <Text style={styles.footerColLine}>{s.contactPhone}</Text> : null}
            {s.contactEmail ? <Text style={styles.footerColLine}>{s.contactEmail}</Text> : null}
            {s.contactWebsite ? <Text style={styles.footerColLine}>{s.contactWebsite}</Text> : null}
          </View>
          <View style={styles.footerCol}>
            <Text style={styles.footerColLabel}>{t`Betaalgegevens`}</Text>
            {s.bankName ? <Text style={styles.footerColLine}>{s.bankName}</Text> : null}
            {s.bankIban ? <Text style={styles.footerColLine}>IBAN: {s.bankIban}</Text> : null}
            {s.bankSwiftBic ? <Text style={styles.footerColLine}>SWIFT/BIC: {s.bankSwiftBic}</Text> : null}
            {s.senderRegistrationNumber ? (
              <Text style={styles.footerColLine}>{t`Ondernemingsnummer`}: {s.senderRegistrationNumber}</Text>
            ) : null}
            {s.senderVatNumber ? <Text style={styles.footerColLine}>{t`BTW nummer`}: {s.senderVatNumber}</Text> : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}
