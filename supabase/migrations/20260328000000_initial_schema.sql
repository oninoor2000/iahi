-- IAHI initial schema: RBAC, profiles, branches, articles, RLS, storage

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE public.app_role AS ENUM ('member', 'admin');
CREATE TYPE public.membership_status AS ENUM ('pending', 'active', 'expired');
CREATE TYPE public.membership_category AS ENUM ('individual', 'institutional');
CREATE TYPE public.article_status AS ENUM ('draft', 'published', 'archived');

-- Branches (regional chapters)
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  region text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Profiles (1:1 with auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  title text,
  profession text,
  institution text,
  member_number text UNIQUE,
  membership_status public.membership_status NOT NULL DEFAULT 'pending',
  membership_category public.membership_category,
  branch_id uuid REFERENCES public.branches (id) ON DELETE SET NULL,
  avatar_url text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_membership_status ON public.profiles (membership_status);
CREATE INDEX idx_profiles_branch_id ON public.profiles (branch_id);

-- Application roles (separate from business membership)
CREATE TABLE public.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member'
);

CREATE TABLE public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text,
  content_html text NOT NULL DEFAULT '',
  content_json jsonb,
  status public.article_status NOT NULL DEFAULT 'draft',
  author_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  category text,
  published_at timestamptz,
  cover_image_url text,
  meta_title text,
  meta_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT articles_published_consistency CHECK (
    (status = 'published' AND published_at IS NOT NULL)
    OR (status IS DISTINCT FROM 'published')
  )
);

CREATE INDEX idx_articles_status_published ON public.articles (status, published_at DESC);
CREATE INDEX idx_articles_author ON public.articles (author_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Slug normalize (basic)
CREATE OR REPLACE FUNCTION public.normalize_article_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NOT NULL THEN
    NEW.slug := lower(trim(both '-' from regexp_replace(NEW.slug, '[^a-z0-9]+', '-', 'gi')));
  END IF;
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    IF NEW.published_at IS NULL THEN
      NEW.published_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER articles_slug_publish
  BEFORE INSERT OR UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.normalize_article_slug();

-- Member number sequence when approved (optional helper)
CREATE SEQUENCE IF NOT EXISTS public.member_number_seq START 1000;

CREATE OR REPLACE FUNCTION public.issue_member_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.membership_status IS DISTINCT FROM 'active'
     AND NEW.membership_status = 'active'
     AND (NEW.member_number IS NULL OR NEW.member_number = '') THEN
    NEW.member_number := 'IAHI-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.member_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_issue_member_number
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.issue_member_number();

-- Protect admin-only fields on profiles for non-admins
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
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_protect_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_admin_fields();

-- RBAC helpers (SECURITY DEFINER, fixed search_path)
CREATE OR REPLACE FUNCTION public.is_admin(check_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = check_uid AND ur.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_member_or_admin(check_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = check_uid AND ur.role IN ('member', 'admin')
  );
$$;

-- New auth user: profile + default member role
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
    membership_category
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'title', ''),
    NULLIF(NEW.raw_user_meta_data->>'institution', ''),
    NULLIF(NEW.raw_user_meta_data->>'profession', ''),
    'pending',
    mc
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Branches
CREATE POLICY "Branches are readable by everyone"
  ON public.branches FOR SELECT
  USING (true);

CREATE POLICY "Branches insert admin"
  ON public.branches FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Branches update admin"
  ON public.branches FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Branches delete admin"
  ON public.branches FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Profiles
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Public read authors of published articles"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.articles a
      WHERE a.author_id = profiles.id
        AND a.status = 'published'
        AND a.published_at IS NOT NULL
        AND a.published_at <= now()
    )
  );

CREATE POLICY "Admin read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- user_roles
CREATE POLICY "Users read own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin read all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin manage roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Articles
CREATE POLICY "Public read published articles"
  ON public.articles FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    AND published_at IS NOT NULL
    AND published_at <= now()
  );

CREATE POLICY "Authors read own articles"
  ON public.articles FOR SELECT
  TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "Admin read all articles"
  ON public.articles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authors insert articles"
  ON public.articles FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_member_or_admin(auth.uid())
  );

CREATE POLICY "Admin update articles"
  ON public.articles FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Authors update own articles"
  ON public.articles FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Admin delete articles"
  ON public.articles FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('article-media', 'article-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Article media public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'article-media');

CREATE POLICY "Authenticated upload article media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'article-media'
    AND public.is_member_or_admin(auth.uid())
  );

-- Seed sample branches (optional)
INSERT INTO public.branches (name, slug, region, display_order) VALUES
  ('Jakarta', 'jakarta', 'DKI Jakarta', 1),
  ('Jawa Barat', 'jawa-barat', 'Jawa Barat', 2),
  ('Jawa Timur', 'jawa-timur', 'Jawa Timur', 3)
ON CONFLICT (slug) DO NOTHING;
