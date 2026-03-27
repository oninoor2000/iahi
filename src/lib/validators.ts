import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(8, 'Minimal 8 karakter'),
});

export const registerSchema = z
  .object({
    email: z.string().email('Email tidak valid'),
    password: z.string().min(8, 'Minimal 8 karakter'),
    fullName: z.string().min(2, 'Nama wajib diisi'),
    title: z.string().optional(),
    institution: z.string().min(2, 'Instansi wajib diisi'),
    profession: z.string().min(2, 'Profesi wajib diisi'),
    membershipCategory: z.enum(['individual', 'institutional'], {
      errorMap: () => ({ message: 'Pilih kategori keanggotaan' }),
    }),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

export const profileUpdateSchema = z.object({
  fullName: z.string().min(2),
  title: z.string().optional(),
  profession: z.string().min(2),
  institution: z.string().min(2),
  bio: z.string().max(2000).optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export const articleMetaSchema = z.object({
  title: z.string().min(3),
  slug: z.string().min(2),
  excerpt: z.string().max(500).optional(),
  category: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().max(320).optional(),
  coverImageUrl: z.string().url().optional().or(z.literal('')),
});

export type ArticleMetaInput = z.infer<typeof articleMetaSchema>;
