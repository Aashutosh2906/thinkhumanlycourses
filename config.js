// =====================================================================
//  YOUR KEYS. Edit the two lines below once, then never again.
//
//  Get both from Supabase: Project Settings > API
//    supabaseUrl  -> "Project URL"
//    supabaseKey  -> the "anon public" key (starts eyJ...) or the
//                    "Publishable key" (starts sb_publishable_...)
//
//  Both are meant to be public, so it's fine that they're on GitHub.
//  NEVER put the "service_role" or "secret" key here.
// =====================================================================
window.SAWAAL_CONFIG = {
  supabaseUrl: "https://apghjxrmjmbenxxdtann.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwZ2hqeHJtam1iZW54eGR0YW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MTM3NzksImV4cCI6MjEwNTQ4OTc3OX0.NC9Vs22LFIpyBDD98XVdTsrq5ba-rxvFVf-DVwBKzkQ",

  // Classes students can pick from on the sign-in form.
  classes: ["5", "6", "7", "8", "9", "10", "11", "12"],

  // Shown in every course's menu. Check these suit your schools' area.
  helpline: {
    text: "Something on your mind? Talk to a trusted adult, or call a free helpline.",
    links: [
      { label: "India: Tele-MANAS 14416 (24x7)", href: "tel:14416" },
      { label: "India: Childline 1098", href: "tel:1098" },
      { label: "Pakistan: Rozan 0304 111 1741", href: "tel:03041111741" },
      { label: "Pakistan: Child Helpline 1121", href: "tel:1121" }
    ]
  }
};
