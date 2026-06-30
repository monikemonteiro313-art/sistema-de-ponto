import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "gen-lang-client-0912799008",
  appId: "1:309073273564:web:1beacdc7d6ddc47829ca19",
  apiKey: "AIzaSyBXqzfEQa4BvMShoTUKKm6Iq1INk2hV4R0",
  authDomain: "gen-lang-client-0912799008.firebaseapp.com",
  storageBucket: "gen-lang-client-0912799008.firebasestorage.app",
  messagingSenderId: "309073273564",
  measurementId: ""
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the custom database ID
export const db = getFirestore(app, "ai-studio-registrodeponto-c804ed9a-d959-4815-854a-eafb29aa305b");
