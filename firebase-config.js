import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, doc, getDoc, setDoc, updateDoc, increment, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAujc2otad5e6-_FCVFZa9IpApz2-M36tc",
  authDomain: "handloom-c8e39.firebaseapp.com",
  projectId: "handloom-c8e39",
  storageBucket: "handloom-c8e39.firebasestorage.app",
  messagingSenderId: "1076141124565",
  appId: "1:1076141124565:web:8581cbee688c6db8c8ab5c",
  measurementId: "G-HZ8CRPDS2E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, doc, getDoc, setDoc, updateDoc, increment, deleteDoc, onSnapshot };
