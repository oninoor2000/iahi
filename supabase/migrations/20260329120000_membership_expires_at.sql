-- Tanggal kedaluwarsa keanggotaan (1 tahun sejak aktivasi)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS membership_expires_at timestamptz;

COMMENT ON COLUMN public.profiles.membership_expires_at IS 'Akhir masa berlaku kartu anggota; diisi otomatis +1 tahun saat status jadi active';

-- Freeze expiry for members (hanya admin yang boleh mengubah via DB / kebijakan terpisah)
CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    NEW.membership_status := OLD.membership_status;
    NEW.member_number := OLD.member_number;
    NEW.branch_id := OLD.branch_id;
    NEW.membership_expires_at := OLD.membership_expires_at;
  END IF;
  RETURN NEW;
END;
$$;

-- Setel tanggal kedaluwarsa ketika admin mengaktifkan anggota (setelah protect + issue number)
CREATE OR REPLACE FUNCTION public.set_membership_expires_on_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.membership_status IS DISTINCT FROM 'active'
     AND NEW.membership_status = 'active' THEN
    NEW.membership_expires_at := now() + interval '1 year';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_t_set_membership_expiry ON public.profiles;

CREATE TRIGGER profiles_t_set_membership_expiry
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_membership_expires_on_activation();

-- Anggota yang sudah aktif sebelum migrasi: perkiraan dari updated_at
UPDATE public.profiles
SET membership_expires_at = updated_at + interval '1 year'
WHERE membership_status = 'active'
  AND membership_expires_at IS NULL;
