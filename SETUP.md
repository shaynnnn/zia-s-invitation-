# Setup in VS Code + Firebase + GitHub Pages

## 1. Create a Firebase project
1. Open https://console.firebase.google.com/ and create a project (example: `zia-vie-marie-rsvp`).
2. In **Build → Authentication → Sign-in method**, enable:
   - **Anonymous** (for guest RSVP submissions without guest accounts)
   - **Email/Password** (for organizer sign-in)
3. In Authentication → Settings → Authorized domains, add your GitHub Pages hostname (for example, `YOUR-USERNAME.github.io`) and keep `localhost` for local testing.
3. In **Build → Firestore Database**, create a database.
4. In **Project settings → General → Your apps**, add a Web App and copy its Firebase configuration.
5. Paste the values into `firebase-config.js`.
6. `firebase-config.js` already lists the two approved organizer emails: `rosmarksurco@gmail.com` and `aguilarshayn@gmail.com`.

## 2. Create the organizer account
1. In Firebase Console → Authentication → Users, choose **Add user**.
2. Create accounts for both approved organizers: `rosmarksurco@gmail.com` and `aguilarshayn@gmail.com`, each with their own strong password. They must both exist in Authentication → Users to sign in.
3. Sign in on the website with that email and password.
4. Never put the admin password or a Firebase service-account key in source code or GitHub.

## 3. Publish Firestore rules
1. Open Firestore Database → Rules.
2. Replace the rules with the contents of `firestore.rules`.
3. Confirm both approved organizer emails appear in the `admin()` function in the rules.
4. Publish the rules.

## 4. Run locally
This is a static website; no npm install is needed.
1. Open the project folder in VS Code.
2. Install the **Live Server** extension.
3. Right-click `index.html` → **Open with Live Server**.
4. Test the public RSVP and organizer sign-in.

Do not test by opening `index.html` directly as a `file://` URL. Use Live Server or another local web server so browser modules work.

## 5. Deploy with GitHub Pages
1. Create a GitHub repository, for example `zia-vie-marie-rsvp`.
2. Upload/push all project files and folders to the repository root.
3. Go to repository **Settings → Pages**.
4. Under **Build and deployment**, choose **GitHub Actions**.
5. The included workflow `.github/workflows/deploy.yml` will publish the site after you push to the `main` branch.
6. Your website URL will look like `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

## 6. Before sharing the link
- Confirm the invitation and thank-you images load on the live URL.
- Test one 1-seat RSVP and one 2-seat RSVP.
- Confirm a 3-seat public reservation is rejected by Firestore rules.
- Confirm public RSVP creation is rejected after December 3, 2026, 11:59 PM Philippines time unless the organizer explicitly reopens RSVPs using the dashboard toggle.
- Sign in as organizer and check the guest list, summary cards, CSV export, and print view.
- Test the site on a phone.

## Current implementation limitations
- Guest self-edit via confirmation screen is not yet implemented securely. The organizer can edit records; guests should contact the organizer for corrections.
- The public RSVP deadline is enforced by the page and Firestore rules. The organizer dashboard toggle can manually close or reopen RSVP submissions and is stored in `settings/rsvpControl`. Admins can still add or manage guest records when RSVP submissions are closed.
- The notification badge and live dashboard update in real time while the admin dashboard is open. Browser push notifications require a later Firebase Cloud Messaging service worker setup; the starter only supports an optional browser notification permission hook.
- Exact map pin is not embedded because the venue address should be confirmed. The Google Maps search button opens a venue search.


## Latest design and sign-in updates
- Single continuous landing page with anchored sections.
- Supplied watercolor fairy artwork is the page background (`public/images/background-zia.jpg`).
- RSVP form opens in a pop-out dialog.
- Text, labels, and form controls are larger for readability.
- Supplied `zia tag.png` fills the thank-you card background.
- Enable **Email/Password** and **Anonymous** providers in Firebase Authentication.
- Create both organizer accounts privately in Firebase Authentication: `rosmarksurco@gmail.com` and `aguilarshayn@gmail.com`. Never put passwords in website files. Google sign-in is not used.
