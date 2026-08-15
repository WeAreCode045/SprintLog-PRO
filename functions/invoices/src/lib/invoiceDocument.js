import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const BRAND_COLOR = '#f4622c';
const MUTED_COLOR = '#666666';
const BORDER_COLOR = '#dddddd';
const CREDIT_COLOR = '#b3261e';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9.5, fontFamily: 'Helvetica', color: '#1a1a1a' },
  title: { fontSize: 28, fontWeight: 700, color: BRAND_COLOR, marginBottom: 6 },
  reference: { fontSize: 10, color: CREDIT_COLOR, fontWeight: 700, marginBottom: 20 },
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
  colDescription: { flex: 4 },
  colQuantity: { flex: 1, textAlign: 'right' },
  colUnitPrice: { flex: 1.2, textAlign: 'right' },
  colVat: { flex: 1, textAlign: 'right' },
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

function formatNumber(value) {
  return `${Number(value ?? 0).toFixed(2)}`;
}

/** Credit notes reverse the original invoice, so every amount is shown negated. */
function formatCreditCurrency(amount, currency) {
  return `${currency} -${Number(amount ?? 0).toFixed(2)}`;
}

function formatInvoiceCurrency(amount, currency) {
  return `${currency} ${Number(amount ?? 0).toFixed(2)}`;
}

function formatDate(iso) {
  if (!iso) return '';
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}-${month}-${year}`;
}

/**
 * Replacement codes admins can type into the free-text settings fields (instructions/footer
 * text), e.g. "Reversing {{creditForInvoice}}." Unknown codes are left as-is so a typo stays
 * visible instead of silently disappearing from the PDF.
 */
function applyPlaceholders(text, tokens) {
  if (!text) return text;
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(tokens, key) ? String(tokens[key] ?? '') : match,
  );
}

/** Invoice-recipient address lines — prefers the dedicated invoice address over the contact
 * address, and appends the invoice country as its own line when set. */
function recipientLines(company) {
  const lines = [];
  const street = company.invoiceAddress || company.address;
  if (street) lines.push(street);
  const postalCode = company.invoicePostalCode || company.postalCode;
  const city = company.invoiceCity || company.city;
  const cityLine = [postalCode, city].filter(Boolean).join(' ');
  if (cityLine) lines.push(cityLine);
  const country = company.invoiceCountry || company.country;
  if (country) lines.push(country);
  return lines;
}

/** Groups items by their own vatRate — mirrors send-invoice/src/invoiceDocument.js#groupVat. */
function groupVat(items) {
  const groups = new Map();
  for (const item of items) {
    const rate = item.vatRate ?? 0;
    const base = (item.quantity ?? 0) * (item.unitPrice ?? 0);
    const group = groups.get(rate) ?? { rate, base: 0 };
    group.base += base;
    groups.set(rate, group);
  }
  return [...groups.values()]
    .sort((a, b) => b.rate - a.rate)
    .map((group) => ({ ...group, amount: Math.round(group.base * group.rate) / 100 }));
}

/**
 * items: [{ description, quantity, unitPrice, vatRate }]
 * settings: InvoiceSettingsRow | null
 * originalInvoiceNumber: the invoice this credit note reverses
 * Built with plain React.createElement — Appwrite Functions here run with no bundler/JSX
 * transform, so JSX syntax would fail to run; @react-pdf/renderer's component model doesn't
 * require it, it's sugar over createElement.
 */
export function buildCreditInvoiceDocument({ invoice, company, items, settings, originalInvoiceNumber }) {
  const e = React.createElement;
  const s = settings ?? {};
  const currency = invoice.currency || 'EUR';
  const vatLabel = s.vatLabel || 'BTW';

  const senderLines = [
    s.senderAddress,
    [s.senderPostalCode, s.senderCity].filter(Boolean).join(' '),
    s.senderCountry,
  ].filter(Boolean);

  const totalAmountValue = invoice.totalWithVat ?? invoice.totalAmount;
  const vatRows = groupVat(items);

  const tokens = {
    invoiceNumber: invoice.invoiceNumber,
    dueDate: formatDate(invoice.dueDate),
    totalAmount: formatCreditCurrency(totalAmountValue, currency),
    bankAccountNumber: s.bankIban || '',
    creditForInvoice: originalInvoiceNumber || '',
  };
  const instructionsText = applyPlaceholders(s.creditInstructionsText, tokens);
  const footerNoteText = applyPlaceholders(s.creditFooterText, tokens);

  return e(
    Document,
    null,
    e(
      Page,
      { size: 'A4', style: styles.page },
      e(Text, { style: styles.title }, 'Creditnota'),
      e(Text, { style: styles.reference }, `Creditnota voor factuur ${originalInvoiceNumber}`),

      e(
        View,
        { style: styles.partiesRow },
        e(
          View,
          { style: styles.partyCol },
          e(Text, { style: styles.partyLabel }, 'Van'),
          e(Text, { style: styles.partyName }, s.senderName || ''),
          ...senderLines.map((line, i) => e(Text, { style: styles.partyLine, key: i }, line)),
        ),
        e(
          View,
          { style: styles.partyCol },
          e(Text, { style: styles.partyLabel }, 'Naar'),
          e(Text, { style: styles.partyName }, company.name),
          ...recipientLines(company).map((line, i) =>
            e(Text, { style: styles.partyLine, key: `recipient-${i}` }, line),
          ),
          company.invoiceEmail || company.email
            ? e(Text, { style: styles.partyLine }, company.invoiceEmail || company.email)
            : null,
          company.vatNumber
            ? e(
                Text,
                { style: styles.partyLine },
                `BTW: ${company.vatNumber}${company.vatExempt ? ' (BTW verlegd — 0%)' : ''}`,
              )
            : null,
        ),
      ),

      e(
        View,
        { style: styles.metaRow },
        e(
          View,
          { style: styles.metaCol },
          e(Text, { style: styles.metaLabel }, 'Creditnotanummer'),
          e(Text, { style: styles.metaValue }, invoice.invoiceNumber),
        ),
        e(
          View,
          { style: styles.metaCol },
          e(Text, { style: styles.metaLabel }, 'Datum'),
          e(Text, { style: styles.metaValue }, formatDate(invoice.issueDate)),
        ),
        e(
          View,
          { style: styles.metaCol },
          e(Text, { style: styles.metaLabel }, 'Oorspronkelijke factuur'),
          e(Text, { style: styles.metaValueDue }, originalInvoiceNumber),
        ),
      ),

      instructionsText
        ? e(View, { style: styles.instructions }, e(Text, { style: styles.instructionsText }, instructionsText))
        : null,

      e(
        View,
        { style: styles.table },
        e(
          View,
          { style: styles.headerRow },
          e(Text, { style: styles.colDescription }, 'Omschrijving'),
          e(Text, { style: styles.colQuantity }, 'Aantal'),
          e(Text, { style: styles.colUnitPrice }, 'Prijs'),
          e(Text, { style: styles.colVat }, 'BTW'),
          e(Text, { style: styles.colTotal }, 'Totaal'),
        ),
        ...items.map((item, i) =>
          e(
            View,
            { style: styles.row, key: i },
            e(Text, { style: styles.colDescription }, item.description),
            e(Text, { style: styles.colQuantity }, formatNumber(item.quantity)),
            e(Text, { style: styles.colUnitPrice }, formatCreditCurrency(item.unitPrice, currency)),
            e(Text, { style: styles.colVat }, `${item.vatRate ?? 0}%`),
            e(Text, { style: styles.colTotal }, formatCreditCurrency(item.quantity * item.unitPrice, currency)),
          ),
        ),
      ),

      e(
        View,
        { style: styles.totals },
        e(
          View,
          { style: styles.totalRow },
          e(Text, null, 'Bedrag excl. BTW'),
          e(Text, null, formatCreditCurrency(invoice.totalAmount, currency)),
        ),
        ...vatRows.map((row) =>
          e(
            View,
            { style: styles.totalRow, key: row.rate },
            e(Text, null, `${vatLabel} (${row.rate}%)`),
            e(Text, null, formatCreditCurrency(row.amount, currency)),
          ),
        ),
        e(
          View,
          { style: styles.totalRowFinal },
          e(Text, null, 'Totaal te crediteren'),
          e(Text, null, formatCreditCurrency(totalAmountValue, currency)),
        ),
      ),

      footerNoteText ? e(Text, { style: styles.footerNote }, footerNoteText) : null,

      e(
        View,
        { style: styles.footer },
        e(
          View,
          { style: styles.footerCol },
          e(Text, { style: styles.footerColLabel }, s.senderName || 'Bedrijfsnaam'),
          s.contactPerson ? e(Text, { style: styles.footerColLine }, s.contactPerson) : null,
          ...senderLines.map((line, i) => e(Text, { style: styles.footerColLine, key: i }, line)),
        ),
        e(
          View,
          { style: styles.footerCol },
          e(Text, { style: styles.footerColLabel }, 'Contact informatie'),
          s.contactPhone ? e(Text, { style: styles.footerColLine }, s.contactPhone) : null,
          s.contactEmail ? e(Text, { style: styles.footerColLine }, s.contactEmail) : null,
          s.contactWebsite ? e(Text, { style: styles.footerColLine }, s.contactWebsite) : null,
        ),
        e(
          View,
          { style: styles.footerCol },
          e(Text, { style: styles.footerColLabel }, 'Betaalgegevens'),
          s.bankName ? e(Text, { style: styles.footerColLine }, s.bankName) : null,
          s.bankIban ? e(Text, { style: styles.footerColLine }, `IBAN: ${s.bankIban}`) : null,
          s.bankSwiftBic ? e(Text, { style: styles.footerColLine }, `SWIFT/BIC: ${s.bankSwiftBic}`) : null,
          s.senderRegistrationNumber
            ? e(Text, { style: styles.footerColLine }, `Ondernemingsnummer: ${s.senderRegistrationNumber}`)
            : null,
          s.senderVatNumber ? e(Text, { style: styles.footerColLine }, `BTW nummer: ${s.senderVatNumber}`) : null,
        ),
      ),
    ),
  );
}
export function buildInvoiceDocument({ invoice, company, items, settings }) {
  const e = React.createElement;
  const s = settings ?? {};
  const currency = invoice.currency;
  const vatLabel = s.vatLabel || 'BTW';

  const senderLines = [
    s.senderAddress,
    [s.senderPostalCode, s.senderCity].filter(Boolean).join(' '),
    s.senderCountry,
  ].filter(Boolean);

  const issueDateIso = invoice.issueDate || invoice.$createdAt || new Date().toISOString();
  const dueDateIso =
    invoice.dueDate || new Date(new Date(issueDateIso).getTime() + 30 * 86400000).toISOString();
  const totalAmountValue = invoice.totalWithVat ?? invoice.totalAmount;
  const vatRows = groupVat(items);

  const tokens = {
    invoiceNumber: invoice.invoiceNumber,
    dueDate: formatDate(dueDateIso),
    totalAmount: formatInvoiceCurrency(totalAmountValue, currency),
    bankAccountNumber: s.bankIban || '',
    creditForInvoice: '',
  };
  const instructionsText = applyPlaceholders(invoice.instructionsText ?? s.defaultInstructionsText, tokens);
  const footerNoteText = applyPlaceholders(
    invoice.footerText ?? company?.generalTerms ?? s.footerText,
    tokens,
  );

  return e(
    Document,
    null,
    e(
      Page,
      { size: 'A4', style: styles.page },
      e(Text, { style: styles.title }, 'Factuur'),

      e(
        View,
        { style: styles.partiesRow },
        e(
          View,
          { style: styles.partyCol },
          e(Text, { style: styles.partyLabel }, 'Van'),
          e(Text, { style: styles.partyName }, s.senderName || ''),
          ...senderLines.map((line, i) => e(Text, { style: styles.partyLine, key: i }, line)),
        ),
        e(
          View,
          { style: styles.partyCol },
          e(Text, { style: styles.partyLabel }, 'Naar'),
          e(Text, { style: styles.partyName }, company.name),
          ...recipientLines(company).map((line, i) =>
            e(Text, { style: styles.partyLine, key: `recipient-${i}` }, line),
          ),
          company.invoiceEmail || company.email
            ? e(Text, { style: styles.partyLine }, company.invoiceEmail || company.email)
            : null,
          company.vatNumber
            ? e(
                Text,
                { style: styles.partyLine },
                `BTW: ${company.vatNumber}${company.vatExempt ? ' (BTW verlegd — 0%)' : ''}`,
              )
            : null,
        ),
      ),

      e(
        View,
        { style: styles.metaRow },
        e(
          View,
          { style: styles.metaCol },
          e(Text, { style: styles.metaLabel }, 'Factuurnummer'),
          e(Text, { style: styles.metaValue }, invoice.invoiceNumber),
        ),
        e(
          View,
          { style: styles.metaCol },
          e(Text, { style: styles.metaLabel }, 'Factuurdatum'),
          e(Text, { style: styles.metaValue }, formatDate(issueDateIso)),
        ),
        e(
          View,
          { style: styles.metaCol },
          e(Text, { style: styles.metaLabel }, 'Betalen voor'),
          e(Text, { style: styles.metaValueDue }, formatDate(dueDateIso)),
        ),
      ),

      instructionsText
        ? e(View, { style: styles.instructions }, e(Text, { style: styles.instructionsText }, instructionsText))
        : null,

      e(
        View,
        { style: styles.table },
        e(
          View,
          { style: styles.headerRow },
          e(Text, { style: styles.colDescription }, 'Omschrijving'),
          e(Text, { style: styles.colQuantity }, 'Aantal'),
          e(Text, { style: styles.colUnitPrice }, 'Prijs'),
          e(Text, { style: styles.colVat }, 'BTW'),
          e(Text, { style: styles.colTotal }, 'Totaal'),
        ),
        ...items.map((item, i) =>
          e(
            View,
            { style: styles.row, key: i },
            e(Text, { style: styles.colDescription }, item.description),
            e(Text, { style: styles.colQuantity }, formatNumber(item.quantity)),
            e(Text, { style: styles.colUnitPrice }, formatInvoiceCurrency(item.unitPrice, currency)),
            e(Text, { style: styles.colVat }, `${item.vatRate ?? 0}%`),
            e(Text, { style: styles.colTotal }, formatInvoiceCurrency(item.quantity * item.unitPrice, currency)),
          ),
        ),
      ),

      e(
        View,
        { style: styles.totals },
        e(
          View,
          { style: styles.totalRow },
          e(Text, null, 'Bedrag excl. BTW'),
          e(Text, null, formatInvoiceCurrency(invoice.totalAmount, currency)),
        ),
        ...vatRows.map((row) =>
          e(
            View,
            { style: styles.totalRow, key: row.rate },
            e(Text, null, `${vatLabel} (${row.rate}%)`),
            e(Text, null, formatInvoiceCurrency(row.amount, currency)),
          ),
        ),
        e(
          View,
          { style: styles.totalRowFinal },
          e(Text, null, 'Totaalbedrag'),
          e(Text, null, formatInvoiceCurrency(totalAmountValue, currency)),
        ),
      ),

      footerNoteText ? e(Text, { style: styles.footerNote }, footerNoteText) : null,

      e(
        View,
        { style: styles.footer },
        e(
          View,
          { style: styles.footerCol },
          e(Text, { style: styles.footerColLabel }, s.senderName || 'Bedrijfsnaam'),
          s.contactPerson ? e(Text, { style: styles.footerColLine }, s.contactPerson) : null,
          ...senderLines.map((line, i) => e(Text, { style: styles.footerColLine, key: i }, line)),
        ),
        e(
          View,
          { style: styles.footerCol },
          e(Text, { style: styles.footerColLabel }, 'Contact informatie'),
          s.contactPhone ? e(Text, { style: styles.footerColLine }, s.contactPhone) : null,
          s.contactEmail ? e(Text, { style: styles.footerColLine }, s.contactEmail) : null,
          s.contactWebsite ? e(Text, { style: styles.footerColLine }, s.contactWebsite) : null,
        ),
        e(
          View,
          { style: styles.footerCol },
          e(Text, { style: styles.footerColLabel }, 'Betaalgegevens'),
          s.bankName ? e(Text, { style: styles.footerColLine }, s.bankName) : null,
          s.bankIban ? e(Text, { style: styles.footerColLine }, `IBAN: ${s.bankIban}`) : null,
          s.bankSwiftBic ? e(Text, { style: styles.footerColLine }, `SWIFT/BIC: ${s.bankSwiftBic}`) : null,
          s.senderRegistrationNumber
            ? e(Text, { style: styles.footerColLine }, `Ondernemingsnummer: ${s.senderRegistrationNumber}`)
            : null,
          s.senderVatNumber ? e(Text, { style: styles.footerColLine }, `BTW nummer: ${s.senderVatNumber}`) : null,
        ),
      ),
    ),
  );
}
