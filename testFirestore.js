const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, query, orderBy } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAujc2otad5e6-_FCVFZa9IpApz2-M36tc",
  authDomain: "handloom-c8e39.firebaseapp.com",
  projectId: "handloom-c8e39",
  storageBucket: "handloom-c8e39.firebasestorage.app",
  messagingSenderId: "1076141124565",
  appId: "1:1076141124565:web:8581cbee688c6db8c8ab5c",
  measurementId: "G-HZ8CRPDS2E"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
    console.log("Testing Firestore Connection...");
    try {
        const q = query(collection(db, "articles"), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const data = [];
        querySnapshot.forEach((doc) => {
            data.push({ id: doc.id, ...doc.data() });
        });
        console.log("Articles:", data);
    } catch (e) {
        console.error("Error querying articles:", e);
    }
}

test();
