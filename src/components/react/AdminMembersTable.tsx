import { useEffect, useMemo, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import type { MembershipStatus } from '@/lib/database.types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatMembershipValidityLine } from '@/lib/membership-display';

type Row = {
  id: string;
  full_name: string;
  institution: string | null;
  profession: string | null;
  membership_status: MembershipStatus;
  member_number: string | null;
  membership_expires_at: string | null;
};

export function AdminMembersTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, institution, profession, membership_status, member_number')
        .order('created_at', { ascending: false });
      if (!cancelled && !error && data) setRows(data as Row[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.membership_status !== statusFilter) return false;
      if (!q) return true;
      const blob = `${r.full_name} ${r.institution ?? ''} ${r.profession ?? ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [rows, filter, statusFilter]);

  async function setStatus(id: string, status: MembershipStatus) {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .update({ membership_status: status })
      .eq('id', id)
      .select('membership_status, member_number, membership_expires_at')
      .single();
    if (error) {
      alert(error.message);
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              membership_status: data.membership_status,
              member_number: data.member_number,
              membership_expires_at: data.membership_expires_at,
            }
          : r,
      ),
    );
  }

  if (loading) return <p className="text-sm text-muted-foreground">Memuat data anggota…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium">Cari</label>
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Nama, institusi, profesi" />
        </div>
        <div className="w-full space-y-2 sm:w-48">
          <label className="text-sm font-medium">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="pending">Menunggu</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="expired">Kedaluwarsa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Institusi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>No.</TableHead>
              <TableHead className="max-w-[200px]">Masa berlaku</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{r.institution ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{r.membership_status}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.member_number ?? '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.membership_expires_at
                    ? formatMembershipValidityLine(r.membership_expires_at)
                    : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    {r.membership_status === 'pending' ? (
                      <Button size="sm" onClick={() => void setStatus(r.id, 'active')}>
                        Setujui
                      </Button>
                    ) : null}
                    {r.membership_status === 'active' ? (
                      <Button size="sm" variant="outline" onClick={() => void setStatus(r.id, 'expired')}>
                        Tandai kedaluwarsa
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
