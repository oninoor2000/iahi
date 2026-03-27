const FALLBACK = 'Berlaku sampai 1 tahun sejak pendaftaran';

/** Tampilan baris masa berlaku; tanggal locale id-ID, zona Asia/Jakarta (+1 tahun sejak pendaftaran). */
export function formatMembershipValidityLine(
  expiresAtIso: string | null | undefined,
): string {
  if (!expiresAtIso) return FALLBACK;
  const d = new Date(expiresAtIso);
  if (Number.isNaN(d.getTime())) return FALLBACK;
  const dateStr = d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
  return `Berlaku hingga ${dateStr} (1 tahun sejak pendaftaran)`;
}
