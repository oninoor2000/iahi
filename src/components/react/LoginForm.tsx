import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { loginSchema, type LoginInput } from '@/lib/validators';

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (signErr) {
      setError(signErr.message);
      return;
    }
    window.location.href = '/dashboard';
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-4">
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
          autoComplete="current-password"
          {...register('password')}
        />
        {errors.password ? (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
        {isSubmitting ? 'Memproses…' : 'Masuk'}
      </Button>
    </form>
  );
}
