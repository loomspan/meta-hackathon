// Copy-time config injection (plan D3): the anon key value is never committed
// in this repository. During deployment, replace __LOOMSPAN_ANON_KEY__ only in
// the copied file in the loomspan.ai repository with the public anon/publishable
// key from the Supabase dashboard (Authentication -> API Keys).
window.LOOMSPAN_SUPABASE_URL = "https://yjrwyfkybszlpufsflan.supabase.co";
window.LOOMSPAN_ANON_KEY = "__LOOMSPAN_ANON_KEY__"; // replaced only in the loomspan.ai copy
