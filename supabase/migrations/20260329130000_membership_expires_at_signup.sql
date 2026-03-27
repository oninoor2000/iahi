-- Masa berlaku +1 tahun sejak pendaftaran; aktivasi admin tidak menimpa jika sudah terisi

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mc public.membership_category;
BEGIN
  IF NEW.raw_user_meta_data->>'membership_category' IN ('individual', 'institutional') THEN
    mc := (NEW.raw_user_meta_data->>'membership_category')::public.membership_category;
  ELSE
    mc := NULL;
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    title,
    institution,
    profession,
    membership_status,
    membership_category,
    membership_expires_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'title', ''),
    NULLIF(NEW.raw_user_meta_data->>'institution', ''),
    NULLIF(NEW.raw_user_meta_data->>'profession', ''),
    'pending',
    mc,
    now() + interval '1 year'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.profiles.membership_expires_at IS 'Akhir masa berlaku: +1 tahun sejak pendaftaran; jika null saat aktivasi, diisi +1 tahun dari aktivasi';

-- Hanya isi saat disetujui jika belum ada tanggal (anggota lama / data impor)
CREATE OR REPLACE FUNCTION public.set_membership_expires_on_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.membership_status IS DISTINCT FROM 'active'
     AND NEW.membership_status = 'active'
     AND NEW.membership_expires_at IS NULL THEN
    NEW.membership_expires_at := now() + interval '1 year';
  END IF;
  RETURN NEW;
END;
$$;

-- Baris yang masih tanpa tanggal: anggap dari created_at
UPDATE public.profiles
SET membership_expires_at = created_at + interval '1 year'
WHERE membership_expires_at IS NULL;
