import { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { sanitizeArticleHtml } from '@/lib/sanitize';
import { slugifyTitle } from '@/lib/slug';
import { articleMetaSchema, type ArticleMetaInput } from '@/lib/validators';
import type { ArticleStatus } from '@/lib/database.types';

/** `articleId`: null = artikel baru; undefined = baca dari query ?id= untuk edit */
type Props = { articleId?: string | null };

export function AdminArticleEditor({ articleId: articleIdProp }: Props) {
  const [resolvedArticleId, setResolvedArticleId] = useState<string | null>(() =>
    articleIdProp !== undefined ? articleIdProp : null,
  );
  const [status, setStatus] = useState<ArticleStatus>('draft');
  const [msg, setMsg] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ArticleMetaInput>({
    resolver: zodResolver(articleMetaSchema),
    defaultValues: { slug: '', title: '', excerpt: '', category: '', metaTitle: '', metaDescription: '', coverImageUrl: '' },
  });

  const titleWatch = watch('title');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Placeholder.configure({ placeholder: 'Tulis isi artikel…' }),
    ],
    editorProps: {
      attributes: {
        class:
          'min-h-[280px] prose-headings:font-semibold focus:outline-none px-3 py-2 rounded-md border border-input bg-background',
      },
    },
  });

  useEffect(() => {
    if (articleIdProp === undefined) {
      const q = new URLSearchParams(window.location.search).get('id');
      setResolvedArticleId(q);
    } else {
      setResolvedArticleId(articleIdProp);
    }
  }, [articleIdProp]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) setUserId(user?.id ?? null);

      if (resolvedArticleId && user) {
        const { data, error } = await supabase
          .from('articles')
          .select('*')
          .eq('id', resolvedArticleId)
          .maybeSingle();
        if (!cancelled && data && !error) {
          reset({
            title: data.title,
            slug: data.slug,
            excerpt: data.excerpt ?? '',
            category: data.category ?? '',
            metaTitle: data.meta_title ?? '',
            metaDescription: data.meta_description ?? '',
            coverImageUrl: data.cover_image_url ?? '',
          });
          setStatus(data.status);
          queueMicrotask(() => editor?.commands.setContent(data.content_html ?? ''));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedArticleId, editor, reset]);

  const syncSlugFromTitle = useCallback(() => {
    if (!titleWatch) return;
    setValue('slug', slugifyTitle(titleWatch), { shouldValidate: true });
  }, [titleWatch, setValue]);

  async function uploadImage(file: File) {
    if (!userId) return;
    const supabase = createBrowserSupabaseClient();
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('article-media').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    const { data: pub } = supabase.storage.from('article-media').getPublicUrl(path);
    editor?.chain().focus().setImage({ src: pub.publicUrl }).run();
  }

  async function saveDraft(values: ArticleMetaInput) {
    await persist(values, 'draft');
  }

  async function publish(values: ArticleMetaInput) {
    await persist(values, 'published');
  }

  async function persist(values: ArticleMetaInput, nextStatus: ArticleStatus) {
    setMsg(null);
    if (!editor || !userId) {
      setMsg('Editor atau sesi belum siap.');
      return;
    }
    const rawHtml = editor.getHTML();
    const html = sanitizeArticleHtml(rawHtml);
    const supabase = createBrowserSupabaseClient();
    const row = {
      title: values.title,
      slug: values.slug || slugifyTitle(values.title),
      excerpt: values.excerpt || null,
      content_html: html,
      content_json: editor.getJSON(),
      category: values.category || null,
      meta_title: values.metaTitle || null,
      meta_description: values.metaDescription || null,
      cover_image_url: values.coverImageUrl?.trim() || null,
      status: nextStatus,
      published_at: nextStatus === 'published' ? new Date().toISOString() : null,
    };

    if (resolvedArticleId) {
      const { error } = await supabase.from('articles').update(row).eq('id', resolvedArticleId);
      if (error) {
        setMsg(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('articles').insert({ ...row, author_id: userId });
      if (error) {
        setMsg(error.message);
        return;
      }
    }

    setStatus(nextStatus);
    setMsg(nextStatus === 'published' ? 'Artikel diterbitkan.' : 'Draf disimpan.');

    if (nextStatus === 'published') {
      await fetch('/api/trigger-rebuild', { method: 'POST', credentials: 'include' }).catch(() => null);
    }
  }

  if (!editor) {
    return <p className="text-sm text-muted-foreground">Menyiapkan editor…</p>;
  }

  return (
    <form className="flex flex-col gap-8" onSubmit={(e) => e.preventDefault()}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Judul</Label>
          <Input id="title" {...register('title')} />
          {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
          <Button type="button" variant="outline" size="sm" className="mt-1" onClick={syncSlugFromTitle}>
            Generate slug dari judul
          </Button>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="slug">Slug URL</Label>
          <Input id="slug" {...register('slug')} />
          {errors.slug ? <p className="text-sm text-destructive">{errors.slug.message}</p> : null}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="excerpt">Ringkasan</Label>
          <Textarea id="excerpt" rows={3} {...register('excerpt')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Kategori</Label>
          <Input id="category" {...register('category')} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as ArticleStatus)} disabled>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">draft</SelectItem>
              <SelectItem value="published">published</SelectItem>
              <SelectItem value="archived">archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="cover">URL gambar sampul</Label>
          <Input id="cover" {...register('coverImageUrl')} placeholder="https://..." />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="metaTitle">Judul SEO (opsional)</Label>
          <Input id="metaTitle" {...register('metaTitle')} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="metaDescription">Meta deskripsi</Label>
          <Textarea id="metaDescription" rows={2} {...register('metaDescription')} />
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            Tebal
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            Miring
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            H2
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            List
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            Kutipan
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const url = window.prompt('URL tautan');
              if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            }}
          >
            Tautan
          </Button>
          <label className="inline-flex cursor-pointer items-center rounded-md border border-input px-3 py-1 text-sm">
            Gambar
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadImage(f);
              }}
            />
          </label>
        </div>
        <EditorContent editor={editor} />
      </div>

      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={handleSubmit(saveDraft)}>
          Simpan draf
        </Button>
        <Button type="button" variant="default" onClick={handleSubmit(publish)}>
          Terbitkan
        </Button>
      </div>
    </form>
  );
}
