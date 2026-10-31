// Archiverse-Pakistan app — the ONLY file you edit to connect the app.
//
// Until the two Supabase values below are filled in, the app runs in
// PREVIEW MODE: every screen works with sample data stored on this device only.
//
// Where to find the values: Supabase dashboard → your project → Settings →
// API → "Project URL" and "anon public" key. The anon key is safe to publish;
// the database's row-level security rules (supabase/schema.sql) do the protecting.

export const CONFIG = {
  supabaseUrl: "YOUR_SUPABASE_URL",          // e.g. "https://abcdefghijklmnop.supabase.co"
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",  // long string starting with "eyJ..."

  // Set to true only after enabling the Google provider in Supabase (README, optional step).
  googleSignIn: false,

  // Shown to institutions and members who need to reach the forum.
  contactEmail: "",

  // Public links
  surveyUrl: "https://forms.gle/UK8Kh8grjyU3Bt166",
  websiteUrl: "../",            // the Archiverse website, relative to the app folder

  // App version — change it when you publish a new build so installed apps update.
  version: "1.0.0",
};
