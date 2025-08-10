// --- [DATABASE & APP INITIALIZATION] ---

// YOUR PERSONAL FIREBASE CONFIGURATION IS NOW INCLUDED
const firebaseConfig = {
  apiKey: "AIzaSyB1TYSc2keBepN_cMV9oaoHFRdcJaAqG_g",
  authDomain: "taskup-9ba7b.firebaseapp.com",
  projectId: "taskup-9ba7b",
  storageBucket: "taskup-9ba7b.appspot.com",
  messagingSenderId: "319481101196",
  appId: "1:319481101196:web:6cded5be97620d98d974a9",
  measurementId: "G-JNNLG1E49L"
};

// Initialize Firebase using the compat libraries
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- [GLOBAL STATE & CONSTANTS] ---
let userState = {};
let telegramUserId = null;
let isInitialized = false;
const TELEGRAM_BOT_USERNAME = "TaskItUpBot";

const DAILY_TASK_LIMIT = 40;
const AD_REWARD = 250;
const REFERRAL_COMMISSION_RATE = 0.10;
const WITHDRAWAL_MINIMUMS = {
    binancepay: 10000 
};

// --- [CORE APP LOGIC] ---

function initializeApp(tgUser) {
    telegramUserId = tgUser ? tgUser.id.toString() : getFakeUserIdForTesting();
    
    console.log(`Initializing app for User ID: ${telegramUserId}`);
    const userRef = db.collection('users').doc(telegramUserId);

    // Use onSnapshot for REAL-TIME updates to the user's own data.
    userRef.onSnapshot(async (doc) => {
        if (!doc.exists) {
            console.log('New user detected. Creating account...');

            // ✅ FIX: Correctly get referrerId from Telegram WebApp or URL
            let referrerId = null;
            if (window.Telegram && window.Telegram.WebApp && Telegram.WebApp.initDataUnsafe) {
                if (Telegram.WebApp.initDataUnsafe.start_param) {
                    referrerId = Telegram.WebApp.initDataUnsafe.start_param;
                }
            }
            if (!referrerId) {
                referrerId = new URLSearchParams(window.location.search).get('ref');
            }

            const newUserState = {
                username: tgUser ? `${tgUser.first_name} ${tgUser.last_name || ''}`.trim() : "User",
                telegramUsername: tgUser ? `@${tgUser.username || tgUser.id}` : `@test_user`,
                profilePicUrl: generatePlaceholderAvatar(telegramUserId),
                balance: 0, tasksCompletedToday: 0, lastTaskTimestamp: null, totalEarned: 0,
                totalAdsViewed: 0, totalRefers: 0, joinedBonusTasks: [],
                referredBy: referrerId || null,
                referralEarnings: 0
            };
            
            // --- FIXED: TRANSACTIONAL REFERRAL CREDIT AT SIGNUP ---
            if (referrerId) {
                const referrerRef = db.collection('users').doc(referrerId);
                try {
                    await db.runTransaction(async (transaction) => {
                        const referrerDoc = await transaction.get(referrerRef);
                        if (!referrerDoc.exists) throw "Referrer not found!";
                        
                        console.log("Crediting referrer instantly upon new user creation.");
                        transaction.update(referrerRef, {
                            totalRefers: firebase.firestore.FieldValue.increment(1)
                        });
                        transaction.set(userRef, newUserState); // Create the new user within the transaction
                    });
                } catch (error) {
                    console.error("Referral transaction failed, creating user normally.", error);
                    await userRef.set(newUserState); // Create user anyway if transaction fails
                }
            } else {
                await userRef.set(newUserState); // Create user if there's no referrer
            }
        } else {
            console.log('User data updated in real-time.');
            userState = doc.data();
        }
        
        if (!isInitialized) {
            setupTaskButtonListeners();
            listenForWithdrawalHistory();
            isInitialized = true;
        }
        updateUI();

    }, (error) => console.error("Error listening to user document:", error));
}

function getFakeUserIdForTesting() { 
    let storedId = localStorage.getItem('localAppUserId'); 
    if (storedId) return storedId; 
    const newId = 'test_user_' + Date.now().toString(36); 
    localStorage.setItem('localAppUserId', newId); 
    return newId; 
}
function generatePlaceholderAvatar(userId) { 
    return `https://i.pravatar.cc/150?u=${userId}`; 
}

// --- [rest of your original script.js code remains unchanged] ---

// --- [APP ENTRY POINT] ---
document.addEventListener('DOMContentLoaded', () => {
    if (window.Telegram && window.Telegram.WebApp) {
        Telegram.WebApp.ready();
        initializeApp(window.Telegram.WebApp.initDataUnsafe.user);
    } else {
        console.warn("Telegram script not found. Running in browser test mode.");
        initializeApp(null);
    }
});
