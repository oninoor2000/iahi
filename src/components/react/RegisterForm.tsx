import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { getPublicSiteOrigin } from '@/lib/site';
import { registerSchema, type RegisterInput } from '@/lib/validators';

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { membershipCategory: 'individual' },
  });

  const category = watch('membershipCategory');

  async function onSubmit(data: RegisterInput) {
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { data: signData, error: signErr } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          title: data.title ?? '',
          institution: data.institution,
          profession: data.profession,
          membership_category: data.membershipCategory,
        },
        emailRedirectTo: `${getPublicSiteOrigin()}/dashboard`,
      },
    });
    if (signErr) {
      setError(signErr.message);
      return;
    }

    const user = signData.user;
    if (user && signData.session) {
      const { error: upErr } = await supabase
        .from('profiles')
        .update({
          full_name: data.fullName,
          title: data.title ?? null,
          institution: data.institution,
          profession: data.profession,
          membership_category: data.membershipCategory,
        })
        .eq('id', user.id);
      if (upErr) {
        setError(upErr.message);
        return;
      }
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="max-w-md rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        <p className="font-medium text-foreground">Pendaftaran diterima</p>
        <p className="mt-2">
          Jika verifikasi email aktif, periksa kotak masuk Anda untuk mengaktifkan akun. Setelah
          masuk, administrator dapat menyetujui keanggotaan Anda.
        </p>
        <a href="/login" className="mt-4 inline-block text-primary underline">
          Ke halaman masuk
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-lg flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="fullName">Nama lengkap</Label>
          <Input id="fullName" {...register('fullName')} />
          {errors.fullName ? (
            <p className="text-sm text-destructive">{errors.fullName.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Gelar (opsional)</Label>
          <Input id="title" {...register('title')} />
        </div>
        <div className="space-y-2">
          <Label>Kategori keanggotaan</Label>
          <Select
            value={category}
            onValueChange={(v) =>
              setValue('membershipCategory', v as RegisterInput['membershipCategory'])
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Individu</SelectItem>
              <SelectItem value="institutional">Institusi</SelectItem>
            </SelectContent>
          </Select>
          {errors.membershipCategory ? (
            <p className="text-sm text-destructive">{errors.membershipCategory.message}</p>
          ) : null}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="institution">Instansi</Label>
          <Input id="institution" {...register('institution')} />
          {errors.institution ? (
            <p className="text-sm text-destructive">{errors.institution.message}</p>
          ) : null}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="profession">Profesi</Label>
          <Input id="profession" {...register('profession')} />
          {errors.profession ? (
            <p className="text-sm text-destructive">{errors.profession.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Kata sandi</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
          />
          {errors.password ? (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Mendaftar…' : 'Kirim pendaftaran'}
      </Button>
    </form>
  );
}
