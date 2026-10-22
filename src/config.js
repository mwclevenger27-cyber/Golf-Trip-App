// Supabase connection. These two values are meant to be public: the database
// rules decide what they can do. Vercel environment variables override them,
// and building with VITE_DEMO=1 runs the browser-only demo instead.
const demo = Boolean(import.meta.env.VITE_DEMO);
export const SUPABASE_URL = demo ? '' : import.meta.env.VITE_SUPABASE_URL || 'https://obeczecfmyrevqsaovhg.supabase.co';
export const SUPABASE_ANON_KEY = demo ? '' : import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_JRnyGuwKczLnnEzhoME-qw_hNCA-GnQ';
