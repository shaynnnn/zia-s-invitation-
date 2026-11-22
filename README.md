# Zia Vie Marie — Seven & Magical RSVP

A mobile-friendly birthday invitation and RSVP site using plain HTML/CSS/JavaScript, Firebase Authentication, and Cloud Firestore. It can be hosted free on GitHub Pages.

## Included
- Responsive invitation page using the two supplied image assets
- Countdown to December 11, 2026 at 7:00 PM (Philippines time)
- Public RSVP with a maximum of 2 seats and adult/kid meal breakdown
- Public birthday wishes wall
- Organizer sign-in for two approved emails and real-time guest dashboard
- Admin edit/delete/manual guest entry, CSV export, and print checklist
- Google Calendar event link
- Thank-you popup using `zia tag.png`

## Important notes
- Public RSVP submission is limited to 2 seats by Firestore Security Rules.
- Both approved organizers must be created in Firebase Authentication: `rosmarksurco@gmail.com` and `aguilarshayn@gmail.com`. Both emails are allowed by the app and Firestore rules.
- Do not publish the Firebase service-account key. This project only uses the Firebase web configuration.
- Guest self-editing is not included in this starter version. The dashboard supports organizer edits; guests can contact the organizer for changes before the deadline. Secure guest self-editing should be added through a verified edit-link/Cloud Function workflow.
- RSVP open/close override is saved in Firestore settings, but the public form's deadline UI is currently date-driven. To make the override control the public form globally, deploy a small Cloud Function or read the settings document before enabling submission. The dashboard toggle writes `settings/rsvpControl`; the public page listens to this setting and Firestore rules enforce it. Admin access is granted to the two allowlisted emails.


The RSVP pop-up contains only reservation fields; the portrait stays in the invitation hero and the thank-you card image stays in the confirmation dialog.
