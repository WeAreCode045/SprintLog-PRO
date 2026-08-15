import { useFieldArray, useFormContext } from 'react-hook-form';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Trans, useLingui } from '@lingui/react/macro';
import { IconPlus, IconTrash } from '../../components/icons';
import type { InvoiceFormValues } from './schema';

interface InvoiceItemRowsProps {
  vatRateHigh: number;
  vatRateLow: number;
  currency: string;
}

export function InvoiceItemRows({ vatRateHigh, vatRateLow, currency }: InvoiceItemRowsProps) {
  const { t } = useLingui();
  const { control, register, watch } = useFormContext<InvoiceFormValues>();
  const { fields, append, remove, move } = useFieldArray({ control, name: 'items' });
  const items = watch('items');

  function addEmptyRow() {
    append({ description: '', quantity: 1, unitPrice: 0, vatRate: vatRateHigh, sourceTimeEntryIds: [] });
  }

  return (
    <div>
      <div className="data-table-wrap">
        <table className="data-table invoice-items-table">
          <thead>
            <tr>
              <th><Trans>Omschrijving</Trans></th>
              <th className="data-table-num"><Trans>Aantal</Trans></th>
              <th className="data-table-num"><Trans>Stuksprijs</Trans></th>
              <th><Trans>BTW</Trans></th>
              <th className="data-table-num"><Trans>Subtotaal</Trans></th>
              <th />
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  <Trans>Nog geen factuurregels.</Trans>
                </td>
              </tr>
            ) : (
              fields.map((field, index) => {
                const quantity = Number(items?.[index]?.quantity ?? 0);
                const unitPrice = Number(items?.[index]?.unitPrice ?? 0);
                return (
                  <tr key={field.id}>
                    <td>
                      <input type="text" {...register(`items.${index}.description`)} placeholder={t`Omschrijving`} />
                    </td>
                    <td className="data-table-num">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="data-table-num">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                      />
                    </td>
                    <td>
                      <select {...register(`items.${index}.vatRate`, { valueAsNumber: true })}>
                        <option value={vatRateHigh}>
                          {t`Hoog`} ({vatRateHigh}%)
                        </option>
                        <option value={vatRateLow}>
                          {t`Laag`} ({vatRateLow}%)
                        </option>
                        <option value={0}>0%</option>
                      </select>
                    </td>
                    <td className="data-table-num">
                      {currency} {(quantity * unitPrice).toFixed(2)}
                    </td>
                    <td>
                      <div className="data-table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          title={t`Omhoog`}
                          disabled={index === 0}
                          onClick={() => move(index, index - 1)}
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          title={t`Omlaag`}
                          disabled={index === fields.length - 1}
                          onClick={() => move(index, index + 1)}
                        >
                          <ChevronDown size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          title={t`Verwijderen`}
                          onClick={() => remove(index)}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="form-actions">
        <button type="button" onClick={addEmptyRow}>
          <IconPlus /> <Trans>Regel toevoegen</Trans>
        </button>
      </div>
    </div>
  );
}
