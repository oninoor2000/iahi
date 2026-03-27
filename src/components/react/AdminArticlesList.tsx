import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ArticleStatus } from '@/lib/database.types';

type Row = {
  id: string;
  title: string;
  slug: string;
  status: ArticleStatus;
  published_at: string | null;
};

export function AdminArticlesList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase
        .from('articles')
        .select('id, title, slug, status, published_at')
        .order('updated_at', { ascending: false });
      if (!cancelled && !error && data) setRows(data as Row[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Memuat artikel…</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild>
          <a href="/admin/articles/new">Artikel baru</a>
        </Button>
      </div>
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Judul</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead className="text-right">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{r.status}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.published_at
                    ? new Date(r.published_at).toLocaleDateString('id-ID')
                    : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/admin/articles/editor?id=${encodeURIComponent(r.id)}`}>Edit</a>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
