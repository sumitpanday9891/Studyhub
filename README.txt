StudyHub project files

Files included:
- index.html
- style.css
- app.js
- firebase.js
- firestore.rules
- README.txt

Firebase setup:
1. Open Firebase Console and select your project.
2. Go to Firestore Database > Rules.
3. Open firestore.rules from this folder, copy its entire contents into the Rules editor, then click Publish.
4. Make sure firebase.js contains your own Firebase project's web configuration.
5. Test while signed in with the configured admin email: sumitpandey9891@gmail.com.

Security note:
These rules are based on the app's current collection names. Review and test them in Firebase before production use. Do not make Firestore publicly writable.
