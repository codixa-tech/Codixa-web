import { useEffect, useState } from 'react';
import { api } from '../data/api.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useToast } from '../components/Toast.jsx';
import { PAYMENT_METHODS } from '../config/categories.js';
import { today } from '../lib/format.js';
import { Field, Modal } from './ui.jsx';

/** Add / edit a payment. `projects` is required when projectId is not fixed. */
export function PaymentModal({ open, onClose, payment, projectId, projects }) {
  const { t, pick } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(payment ? { ...payment } : { projectId: projectId || '', amount: '', date: today(), method: 'bank', reference: '', note: '' });
      setErrors({});
    }
  }, [open, payment, projectId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const currency = projects?.find((p) => p.id === form.projectId)?.currency;

  const save = async (e) => {
    e?.preventDefault();
    const er = {};
    if (!form.projectId) er.projectId = t('dash.payments.pickProject');
    if (!(Number(form.amount) > 0)) er.amount = t('dash.payments.positive');
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const { project, client, ...clean } = form;
      await api.payments.save({ ...clean, amount: Number(form.amount) });
      toast(t('dash.payments.saved'));
      onClose();
    } catch {
      toast(t('contact.error'), 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={payment ? t('dash.common.edit') : t('dash.payments.add')}
      footer={
        <>
          <button className="btn btn--ghost btn--sm dark-ghost" onClick={onClose}>
            {t('dash.payments.cancel')}
          </button>
          <button className="btn btn--sm" onClick={save} disabled={busy}>
            {t('dash.payments.save')}
          </button>
        </>
      }
    >
      <form className="dgrid" onSubmit={save}>
        {!projectId && (
          <Field label={t('dash.payments.project')} error={errors.projectId} wide>
            {(id) => (
              <select id={id} value={form.projectId || ''} onChange={set('projectId')} data-autofocus>
                <option value="">{t('dash.editor.select')}</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {pick(p.title)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        <Field label={`${t('dash.payments.amount')}${currency ? ` (${currency})` : ''}`} error={errors.amount}>
          {(id) => <input id={id} type="number" inputMode="decimal" min="0" step="0.01" value={form.amount ?? ''} onChange={set('amount')} dir="ltr" data-autofocus={projectId ? true : undefined} />}
        </Field>
        <Field label={t('dash.payments.date')}>{(id) => <input id={id} type="date" value={form.date || ''} onChange={set('date')} />}</Field>
        <Field label={t('dash.payments.method')}>
          {(id) => (
            <select id={id} value={form.method || ''} onChange={set('method')}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.key} value={m.key}>
                  {pick(m)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t('dash.payments.reference')}>{(id) => <input id={id} value={form.reference || ''} onChange={set('reference')} dir="ltr" />}</Field>
        <Field label={t('dash.payments.note')} wide>
          {(id) => <input id={id} value={form.note || ''} onChange={set('note')} />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export function ClientModal({ open, onClose, client, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(client ? { ...client } : { name: '', company: '', email: '', phone: '', country: '', address: '', idNumber: '', notes: '' });
      setError('');
    }
  }, [open, client]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async (e) => {
    e?.preventDefault();
    if (!form.name?.trim()) return setError(t('dash.editor.required'));
    const saved = await api.clients.save(form);
    toast(t('dash.clients.saved'));
    onSaved?.(saved);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? t('dash.clients.edit') : t('dash.clients.add')}
      footer={
        <>
          <button className="btn btn--ghost btn--sm dark-ghost" onClick={onClose}>
            {t('dash.common.cancel')}
          </button>
          <button className="btn btn--sm" onClick={save}>
            {t('dash.clients.save')}
          </button>
        </>
      }
    >
      <form className="dgrid" onSubmit={save}>
        <Field label={t('dash.clients.name')} error={error}>
          {(id) => <input id={id} value={form.name || ''} onChange={set('name')} data-autofocus />}
        </Field>
        <Field label={t('dash.clients.company')}>{(id) => <input id={id} value={form.company || ''} onChange={set('company')} />}</Field>
        <Field label={t('dash.clients.email')}>{(id) => <input id={id} type="email" value={form.email || ''} onChange={set('email')} dir="ltr" />}</Field>
        <Field label={t('dash.clients.phone')}>{(id) => <input id={id} type="tel" value={form.phone || ''} onChange={set('phone')} dir="ltr" />}</Field>
        <Field label={t('dash.clients.country')}>{(id) => <input id={id} value={form.country || ''} onChange={set('country')} />}</Field>
        <Field label={t('dash.clients.idNumber')}>{(id) => <input id={id} value={form.idNumber || ''} onChange={set('idNumber')} dir="ltr" />}</Field>
        <Field label={t('dash.clients.address')} wide>
          {(id) => <input id={id} value={form.address || ''} onChange={set('address')} />}
        </Field>
        <Field label={t('dash.clients.notes')} wide>
          {(id) => <textarea id={id} rows={3} value={form.notes || ''} onChange={set('notes')} />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
