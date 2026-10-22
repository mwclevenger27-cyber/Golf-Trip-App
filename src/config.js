// Supabase connection. These two values are meant to be public: the database
// rules decide what they can do. Vercel environment variables override them.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://obeczecfmyrevqsaovhg.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_JRnyGuwKczLnnEzhoME-qw_hNCA-GnQ';
