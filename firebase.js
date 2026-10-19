// StudyHub Firebase Configuration

import {
  initializeApp
  } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";

  import {
    getAuth
    } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

    import {
      getFirestore
      } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";


      // Your Firebase Project Configuration
      const firebaseConfig = {
        apiKey: "AIzaSyBTv1MeZ4L3KTjljZPVTAF4hkbBzlwsnSQ",
          authDomain: "study-app-30ce4.firebaseapp.com",
            projectId: "study-app-30ce4",
              storageBucket: "study-app-30ce4.firebasestorage.app",
                messagingSenderId: "1091099298773",
                  appId: "1:1091099298773:web:075d86b7b322f7f53a8b5c",
                    measurementId: "G-BPPF358FJK"
                    };


                    // Initialize Firebase
                    const app = initializeApp(firebaseConfig);


                    // Initialize Authentication
                    export const auth = getAuth(app);


                    // Initialize Firestore Database
                    export const db = getFirestore(app);


                    // Export Firebase App
                    export default app;