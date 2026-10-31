// Sample data for PREVIEW MODE only. Nothing here is a real statement by a
// real person or institution; names are placeholders. It lets every screen
// be previewed before Supabase is connected. Changes made in preview mode
// are stored only in this browser (localStorage) and can be reset.

const daysAgo = (d, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString();

export const DEMO_ACCOUNTS = {
  "founder@example.com": "u-founder",
  "student@example.com": "u-student",
  "graduate@example.com": "u-graduate",
  "educator@example.com": "u-educator",
  "practitioner@example.com": "u-practitioner",
  "institution@example.com": "u-institution",
  "pending-institution@example.com": "u-institution2",
};

export function demoSeed() {
  return {
    sessionUserId: null,
    profiles: [
      { id: "u-founder", email: "founder@example.com", display_name: "Rana Mohsin Ali", role: "practitioner", institution: "Archiverse-Pakistan", city: "Lahore", bio: "Founder, Archiverse-Pakistan.", is_admin: true, is_verified_institution: false, notify_in_app: true, notify_email: false, created_at: daysAgo(30) },
      { id: "u-student", email: "student@example.com", display_name: "Sample Student", role: "student", institution: "A school of architecture (sample)", city: "Karachi", bio: "", is_admin: false, is_verified_institution: false, notify_in_app: true, notify_email: false, created_at: daysAgo(20) },
      { id: "u-graduate", email: "graduate@example.com", display_name: "Sample Graduate", role: "graduate", institution: "", city: "Lahore", bio: "", is_admin: false, is_verified_institution: false, notify_in_app: true, notify_email: false, created_at: daysAgo(18) },
      { id: "u-educator", email: "educator@example.com", display_name: "Sample Educator", role: "educator", institution: "A department of architecture (sample)", city: "Islamabad", bio: "", is_admin: false, is_verified_institution: false, notify_in_app: true, notify_email: false, created_at: daysAgo(15) },
      { id: "u-practitioner", email: "practitioner@example.com", display_name: "Sample Practitioner", role: "practitioner", institution: "A design practice (sample)", city: "Karachi", bio: "", is_admin: false, is_verified_institution: false, notify_in_app: true, notify_email: false, created_at: daysAgo(12) },
      { id: "u-institution", email: "institution@example.com", display_name: "Sample Institution (verified)", role: "institution", institution: "Sample Regulatory Body", city: "Islamabad", bio: "Official account (sample).", is_admin: false, is_verified_institution: true, notify_in_app: true, notify_email: false, created_at: daysAgo(10) },
      { id: "u-institution2", email: "pending-institution@example.com", display_name: "Sample Department (awaiting verification)", role: "institution", institution: "Sample University Department", city: "Peshawar", bio: "", is_admin: false, is_verified_institution: false, notify_in_app: true, notify_email: false, created_at: daysAgo(2) },
    ],
    debates: [
      { id: "d-1", title: "What is the one skill or lesson your architecture education did not give you?", question: "The forum's first question. Tell us your university or firm, the year you graduated, and one gap you have felt. Bring an example if you can. Label your claim: verified fact, community experience, or opinion.", pillar: "learn", front: "syllabus", created_by: "u-founder", pinned: true, closed: false, hidden: false, outcome: null, created_at: daysAgo(9) },
      { id: "d-2", title: "Should BIM be a required part of every B.Arch programme by 2028?", question: "Many firms now expect BIM on day one. Should the curriculum require it, and if so, in which year and at the cost of what? Proposals welcome.", pillar: "learn", front: "syllabus", created_by: "u-practitioner", pinned: false, closed: false, hidden: false, outcome: null, created_at: daysAgo(5) },
      { id: "d-3", title: "Who checks that the Pakistan Building Code is enforced, and how would we know?", question: "The code exists. What evidence would show it is being enforced: inspection records, post-occupancy reviews, published enforcement data? What should Archiverse ask the building authorities to publish?", pillar: "accountable", front: "system", created_by: "u-educator", pinned: false, closed: false, hidden: false, outcome: null, created_at: daysAgo(2) },
    ],
    posts: [
      { id: "p-1", debate_id: "d-1", parent_id: null, author_id: "u-graduate", kind: "comment", body: "Sample post. In my own first year of work I had never priced a drawing set or written a fee letter. The studio taught design; nobody taught the business side.", claim_label: "community_experience", source_url: null, hidden: false, hidden_reason: null, created_at: daysAgo(8) },
      { id: "p-2", debate_id: "d-1", parent_id: "p-1", author_id: "u-practitioner", kind: "comment", body: "Sample reply. We see the same gap when hiring. A one-semester practice module with real contracts would help.", claim_label: "community_experience", source_url: null, hidden: false, hidden_reason: null, created_at: daysAgo(7) },
      { id: "p-3", debate_id: "d-1", parent_id: null, author_id: "u-student", kind: "comment", body: "Sample post. Site visits were rare in my programme. I would like to see how other countries handle site exposure before final year.", claim_label: "opinion", source_url: null, hidden: false, hidden_reason: null, created_at: daysAgo(6) },
      { id: "p-4", debate_id: "d-1", parent_id: null, author_id: "u-educator", kind: "proposal", body: "Sample proposal: a compulsory 8-week supervised site placement in fourth year, assessed jointly by the department and the host firm, with a published list of host firms each year.", claim_label: "opinion", source_url: null, hidden: false, hidden_reason: null, created_at: daysAgo(5) },
      { id: "p-5", debate_id: "d-2", parent_id: null, author_id: "u-practitioner", kind: "proposal", body: "Sample proposal: BIM as a required course from third year, assessed on a real coordinated model, with departments publishing the software and hardware they provide.", claim_label: "opinion", source_url: null, hidden: false, hidden_reason: null, created_at: daysAgo(4) },
      { id: "p-6", debate_id: "d-2", parent_id: null, author_id: "u-student", kind: "comment", body: "Sample post. Our lab computers cannot run the software. Any requirement needs a funding line or it will only be on paper.", claim_label: "community_experience", source_url: null, hidden: false, hidden_reason: null, created_at: daysAgo(3) },
      { id: "p-7", debate_id: "d-3", parent_id: null, author_id: "u-graduate", kind: "proposal", body: "Sample proposal: ask each building authority to publish, yearly, the number of inspections carried out, violations found and actions taken. Archiverse compiles the replies into one public table.", claim_label: "opinion", source_url: null, hidden: false, hidden_reason: null, created_at: daysAgo(1) },
      { id: "p-8", debate_id: "d-3", parent_id: null, author_id: "u-student", kind: "comment", body: "Sample post that was hidden by the moderator for breaking rule 1. (This shows what a hidden post looks like to the admin.)", claim_label: null, source_url: null, hidden: true, hidden_reason: "Hidden by moderator: rule 1 (respect people)", created_at: daysAgo(1, 2) },
    ],
    votes: [
      { post_id: "p-4", user_id: "u-graduate", created_at: daysAgo(4) },
      { post_id: "p-4", user_id: "u-practitioner", created_at: daysAgo(4) },
      { post_id: "p-4", user_id: "u-student", created_at: daysAgo(3) },
      { post_id: "p-5", user_id: "u-graduate", created_at: daysAgo(3) },
      { post_id: "p-7", user_id: "u-educator", created_at: daysAgo(1) },
    ],
    reports: [
      { id: "r-1", post_id: "p-8", reporter_id: "u-graduate", reason: "Names and attacks a person rather than the decision (rule 1).", status: "open", resolution: null, created_at: daysAgo(1, 1), resolved_at: null },
    ],
    blocks: [],
    notifications: [
      { id: "n-1", user_id: "u-student", type: "new_debate", title: "New debate: Who checks that the Pakistan Building Code is enforced, and how would we know?", body: "The code exists. What evidence would show it is being enforced?", link: "#/debates/d-3", read: false, created_at: daysAgo(2) },
      { id: "n-2", user_id: "u-founder", type: "new_debate", title: "New debate: Who checks that the Pakistan Building Code is enforced, and how would we know?", body: "The code exists. What evidence would show it is being enforced?", link: "#/debates/d-3", read: false, created_at: daysAgo(2) },
      { id: "n-3", user_id: "u-founder", type: "new_debate", title: "New debate: Should BIM be a required part of every B.Arch programme by 2028?", body: "Many firms now expect BIM on day one.", link: "#/debates/d-2", read: true, created_at: daysAgo(5) },
      { id: "n-4", user_id: "u-graduate", type: "reply", title: "New reply in: What is the one skill or lesson your architecture education did not give you?", body: "Sample reply. We see the same gap when hiring.", link: "#/debates/d-1", read: false, created_at: daysAgo(7) },
    ],
    responses: [
      { id: "ir-1", piece_type: "article", piece_id: "dormant-institutions", piece_title: "Dormant Institutions", institution_id: "u-institution", institution_name: "Sample Regulatory Body", body: "SAMPLE RESPONSE (placeholder text, not a real statement). This shows how an institution's on-record response appears next to the piece it concerns: in full, unedited, with the date and the account that submitted it.\n\nA real response would set out the institution's position, cite the documents it relies on, and say what it intends to do.", correction_note: "Sample correction note added later by the institution: a figure in the second paragraph was corrected. Correction notes are dated and shown beside the original text, which is never changed.", corrected_at: daysAgo(3), created_at: daysAgo(6) },
    ],
  };
}
