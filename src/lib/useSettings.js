import { api } from '../data/api.js';
import { useData } from './useData.js';
import { SITE } from '../config/site.js';

/** Public site settings (contact data, social links, partner) managed from the dashboard. */
export function useSettings() {
  const { data } = useData(() => api.settings.get(), []);
  return data || { email: SITE.email, phone: SITE.phone, whatsapp: SITE.whatsapp, address: SITE.address, partnerName: SITE.partner.name, partnerUrl: '', social: {} };
}

export const waLink = (num) => `https://wa.me/${String(num || '').replace(/\D/g, '')}`;
export const telLink = (num) => `tel:${String(num || '').replace(/[^\d+]/g, '')}`;
