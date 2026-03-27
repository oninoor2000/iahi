import { useRef } from 'react';
import QRCode from 'react-qr-code';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Button } from '@/components/ui/button';
import type { MembershipStatus } from '@/lib/database.types';
import { getPublicSiteOrigin } from '@/lib/site';

type CardProfile = {
  full_name: string;
  member_number: string | null;
  institution: string | null;
  profession: string | null;
  membership_status: MembershipStatus;
};

export function MemberCardDownload({ profile }: { profile: CardProfile }) {
  const ref = useRef<HTMLDivElement>(null);
  const sitePublic = getPublicSiteOrigin();
  const qrUrl =
    profile.member_number != null
      ? `${sitePublic}/anggota/verify?id=${encodeURIComponent(profile.member_number)}`
      : sitePublic;

  const canDownload =
    profile.membership_status === 'active' && profile.member_number && profile.full_name;

  async function downloadPng() {
    const node = ref.current;
    if (!node || !canDownload) return;
    const dataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `kartu-iahi-${profile.member_number}.png`;
    a.click();
  }

  async function downloadPdf() {
    const node = ref.current;
    if (!node || !canDownload) return;
    const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [86, 54] });
    pdf.addImage(dataUrl, 'PNG', 0, 0, 86, 54);
    pdf.save(`kartu-iahi-${profile.member_number}.pdf`);
  }

  return (
    <div className="space-y-4">
      <div
        ref={ref}
        className="w-[340px] rounded-xl border border-border bg-card p-5 shadow-sm"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 pr-1">
            <p className="text-[10px] font-semibold leading-snug text-primary">
              Kartu Anggota Perhimpunan Informatika Kesehatan Indonesia
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">{profile.full_name}</p>
            <p className="text-sm text-muted-foreground">{profile.profession ?? '—'}</p>
            <p className="mt-2 text-xs text-muted-foreground">{profile.institution ?? '—'}</p>
            {profile.member_number ? (
              <p className="mt-3 text-sm font-mono text-foreground">{profile.member_number}</p>
            ) : null}
          </div>
          <div className="rounded-md border border-border bg-white p-1">
            {profile.member_number ? (
              <QRCode value={qrUrl} size={72} level="M" />
            ) : (
              <div className="flex h-[72px] w-[72px] items-center justify-center text-[10px] text-muted-foreground">
                —
              </div>
            )}
          </div>
        </div>
        <p className="mt-4 text-[10px] leading-snug text-muted-foreground">
          Berlaku sampai 1 tahun sejak keanggotaan disetujui
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={!canDownload} onClick={() => void downloadPng()}>
          Unduh PNG
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canDownload}
          onClick={() => void downloadPdf()}
        >
          Unduh PDF
        </Button>
      </div>
      {!canDownload ? (
        <p className="text-xs text-muted-foreground">
          Kartu dapat diunduh setelah status keanggotaan aktif dan nomor anggota tersedia.
        </p>
      ) : null}
    </div>
  );
}
