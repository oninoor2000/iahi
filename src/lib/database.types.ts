export type AppRole = 'member' | 'admin';
export type MembershipStatus = 'pending' | 'active' | 'expired';
export type MembershipCategory = 'individual' | 'institutional';
export type ArticleStatus = 'draft' | 'published' | 'archived';

export interface Database {
  public: {
    Tables: {
      branches: {
        Row: {
          id: string;
          name: string;
          slug: string;
          region: string | null;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          region?: string | null;
          display_order?: number;
        };
        Update: Partial<Database['public']['Tables']['branches']['Insert']>;
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          title: string | null;
          profession: string | null;
          institution: string | null;
          member_number: string | null;
          membership_status: MembershipStatus;
          membership_expires_at: string | null;
          membership_category: MembershipCategory | null;
          branch_id: string | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          title?: string | null;
          profession?: string | null;
          institution?: string | null;
          member_number?: string | null;
          membership_status?: MembershipStatus;
          membership_expires_at?: string | null;
          membership_category?: MembershipCategory | null;
          branch_id?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      user_roles: {
        Row: {
          user_id: string;
          role: AppRole;
        };
        Insert: {
          user_id: string;
          role: AppRole;
        };
        Update: Partial<Database['public']['Tables']['user_roles']['Insert']>;
      };
      articles: {
        Row: {
          id: string;
          title: string;
          slug: string;
          excerpt: string | null;
          content_html: string;
          content_json: unknown | null;
          status: ArticleStatus;
          author_id: string;
          category: string | null;
          published_at: string | null;
          cover_image_url: string | null;
          meta_title: string | null;
          meta_description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          excerpt?: string | null;
          content_html?: string;
          content_json?: unknown | null;
          status?: ArticleStatus;
          author_id: string;
          category?: string | null;
          published_at?: string | null;
          cover_image_url?: string | null;
          meta_title?: string | null;
          meta_description?: string | null;
        };
        Update: Partial<Database['public']['Tables']['articles']['Insert']>;
      };
    };
  };
}
