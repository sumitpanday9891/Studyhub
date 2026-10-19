# StudyHub Premium — VS Code starter

## Run
1. Extract this ZIP and open the `StudyHub` folder in VS Code.
2. Install the Live Server extension.
3. Right-click `index.html` → Open with Live Server. Do not open using `file://`.
4. In Firebase Console → Authentication → Sign-in method, enable Email/Password.
5. Create/verify the admin user `sumitpandey9891@gmail.com` with a password you choose.
6. Firestore Database → Rules: paste `firestore.rules` and Publish.
7. Confirm `firebase.js` config matches Firebase Console → Project settings → Your apps → Web app.

## Features
- Single HTML app with responsive premium-style UI.
- Student signup/login/password reset and profile/class selection.
- Admin class and batch creation/deletion.
- Add/delete lecture links, notes/PDF links, DPP/material links.
- Quiz builder (questions, four options, correct answer) and student quiz submission.
- Batch enrollment, progress tracking, admin ranking report.
- YouTube embed for standard YouTube URLs; other video/PDF links open as external links.

## Important
- Admin email is `sumitpandey9891@gmail.com`. The Firestore rules require that email to be verified.
- Firebase web config is client-side and is not a password. Never publish private service-account keys.
- This is a starter LMS, not a security-audited production system. In this starter, correct answers are present in quiz documents readable by signed-in users and quiz scores are calculated in the browser. For important exams, use a trusted backend/Cloud Function to keep answer keys secret and validate scoring.
- File upload itself is not included; this version accepts public/authorised HTTPS links to hosted video/PDF/material.
