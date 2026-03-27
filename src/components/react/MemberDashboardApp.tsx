import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { profileUpdateSchema, type ProfileUpdateInput } from '@/lib/validators';
import type { MembershipStatus } from '@/lib/database.types';
import { MemberCardDownload } from '@/components/react/MemberCardDownload';

const statusLabel: Record<MembershipStatus, string> = {
  pending: 'Menunggu persetujuan',
  active: 'Aktif',
  expired: 'Kedaluwarsa',
};

export function MemberDashboardApp() {
  const [loading, setLoading] = useState(true);
  const [profileState, setProfileState] = useState<{
    id: string;
    full_name: string;
    title: string | null;
    profession: string | null;
    institution: string | null;
    bio: string | null;
    avatar_url: string | null;
    membership_status: MembershipStatus;
    member_number: string | null;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileUpdateInput>({ resolver: zodResolver(profileUpdateSchema) });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (error || !data || cancelled) {
        setLoading(false);
        return;
      }
      setProfileState(data);
      reset({
        fullName: data.full_name,
        title: data.title ?? '',
        profession: data.profession ?? '',
        institution: data.institution ?? '',
        bio: data.bio ?? '',
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reset]);

  async function onSubmit(values: ProfileUpdateInput) {
    setMessage(null);
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: values.fullName,
        title: values.title || null,
        profession: values.profession,
        institution: values.institution,
        bio: values.bio || null,
      })
      .eq('id', user.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage('Profil disimpan.');
    setProfileState((p) =>
      p
        ? {
            ...p,
            full_name: values.fullName,
            title: values.title || null,
            profession: values.profession,
            institution: values.institution,
            bio: values.bio || null,
          }
        : p,
    );
  }

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  if (loading || !profileState) {
    return <p className="text-sm text-muted-foreground">Memuat profil…</p>;
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr,320px]">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-primary">Profil</h2>
          <Badge variant="secondary">{statusLabel[profileState.membership_status]}</Badge>
          {profileState.member_number ? (
            <span className="text-sm text-muted-foreground">
              No. anggota: {profileState.member_number}
            </span>
          ) : null}
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex max-w-xl flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nama lengkap</Label>
            <Input id="fullName" {...register('fullName')} />
            {errors.fullName ? (
              <p className="text-sm text-destructive">{errors.fullName.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Gelar</Label>
            <Input id="title" {...register('title')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="institution">Instansi</Label>
            <Input id="institution" {...register('institution')} />
            {errors.institution ? (
              <p className="text-sm text-destructive">{errors.institution.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="profession">Profesi</Label>
            <Input id="profession" {...register('profession')} />
            {errors.profession ? (
              <p className="text-sm text-destructive">{errors.profession.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio singkat</Label>
            <Textarea id="bio" rows={4} {...register('bio')} />
          </div>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={isSubmitting}>
              Simpan perubahan
            </Button>
            <Button type="button" variant="outline" onClick={() => void signOut()}>
              Keluar
            </Button>
          </div>
        </form>
      </div>
      <div>
        <h3 className="text-sm font-medium text-foreground">Kartu anggota digital</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Tersedia setelah keanggotaan aktif dan nomor anggota diterbitkan.
        </p>
        <div className="mt-4">
          <MemberCardDownload profile={profileState} />
        </div>
      </div>
    </div>
  );
}
