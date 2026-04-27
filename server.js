const app = require('./app');
const initializeFirebase = require('./config/firebase');

const requiredEnv = ['JWT_SECRET', 'GAS_WEBAPP_URL', 'GAS_API_KEY', 'FIREBASE_SERVICE_ACCOUNT'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.warn(`Missing required environment variables: ${missingEnv.join(', ')}`);
  if (missingEnv.includes('JWT_SECRET')) {
    console.warn('JWT_SECRET is required for /api/auth/login and /api/auth/register. Please add it to .env.');
  }
  if (missingEnv.includes('GAS_WEBAPP_URL') || missingEnv.includes('GAS_API_KEY')) {
    console.warn('GAS_WEBAPP_URL and GAS_API_KEY are required for user authentication and GAS-based data access.');
  }
  if (missingEnv.includes('FIREBASE_SERVICE_ACCOUNT')) {
    console.warn('FIREBASE_SERVICE_ACCOUNT is required to initialize Firebase Admin SDK for Firestore writes.');
  }
}

const port = process.env.PORT || 4000;
let firebaseInitialized = false;

try {
  initializeFirebase();
  firebaseInitialized = true;
} catch (err) {
  console.warn('Firebase initialization failed. Server will still start, but Firestore features may not work:', err.message);
}

app.listen(port, () => {
  console.log(`Attendance backend running on port ${port}`);
  if (!firebaseInitialized) {
    console.warn('Warning: Firebase was not initialized. Attendance and manager routes may fail if they depend on Firestore.');
  }
});
