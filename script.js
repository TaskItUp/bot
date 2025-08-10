// =======================
// Firebase Config
// =======================
const firebaseConfig = {
    apiKey: "AIzaSyB1TYSc2keBepN_cMV9oaoHFRdcJaAqG_g",
    authDomain: "taskup-9ba7b.firebaseapp.com",
    projectId: "taskup-9ba7b",
    storageBucket: "taskup-9ba7b.appspot.com",
    messagingSenderId: "319481101196",
    appId: "1:319481101196:web:6cded5be97620d98d974a9",
    measurementId: "G-JNNLG1E49L"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// =======================
// Global State
// =======================
let userState = {};
let telegramUserId = null;
let isInitialized = false;

const DAILY_TASK_LIMIT = 40;
const REFERRAL_COMMISSION_RATE = 0.10;

// =======================
// Initialize App
// =======================
function initializeApp(tgUser) {
    telegramUserId = tgUser ? tgUser.id.toString() : getFakeUserIdForTesting();
    const userRef = db.collection('users').doc(telegramUserId);

    userRef.onSnapshot(async (doc) => {
        if (!doc.exists) {
            console.log("New user detected. Creating account...");
            const startParam =
                tgUser?.start_param?.toString() ||
                new URLSearchParams(window.location.search).get('ref') ||
                null;

            const newUserData = {
                username: tgUser ? `${tgUser.first_name} ${tgUser.last_name || ''}`.trim() : "User",
                telegramUsername: tgUser ? `@${tgUser.username || tgUser.id}` : `@test_user`,
                profilePicUrl: generatePlaceholderAvatar(telegramUserId),
                balance: 0,
                tasksCompletedToday: 0,
                totalEarned: 0,
                totalAdsViewed: 0,
                totalRefers: 0,
                referralEarnings: 0,
                joined: firebase.firestore.FieldValue.serverTimestamp(),
                referrals: [],
                referredBy: startParam || null
            };

            // Handle referral
            if (startParam && startParam !== telegramUserId) {
                const referrerRef = db.collection("users").doc(startParam);
                const refSnap = await referrerRef.get();

                if (refSnap.exists) {
                    let refData = refSnap.data();
                    if (!refData.referrals?.includes(telegramUserId)) {
                        await referrerRef.update({
                            referrals: firebase.firestore.FieldValue.arrayUnion(telegramUserId),
                            totalRefers: firebase.firestore.FieldValue.increment(1)
                        });
                    }
                }
            }

            await userRef.set(newUserData);
        } else {
            userState = doc.data();
        }

        if (!isInitialized) {
            setupEarningListener();
            updateUI();
            isInitialized = true;
        }
    });
}

// =======================
// Referral Commission
// =======================
function setupEarningListener() {
    const userRef = db.collection('users').doc(telegramUserId);

    // Listen for balance changes to trigger referral commissions
    userRef.onSnapshot(async (doc) => {
        if (!doc.exists) return;
        const oldBalance = userState.balance || 0;
        const newBalance = doc.data().balance || 0;

        if (newBalance > oldBalance) {
            const earned = newBalance - oldBalance;
            if (userState.referredBy) {
                const commission = Math.floor(earned * REFERRAL_COMMISSION_RATE);
                const referrerRef = db.collection('users').doc(userState.referredBy);

                await referrerRef.update({
                    balance: firebase.firestore.FieldValue.increment(commission),
                    referralEarnings: firebase.firestore.FieldValue.increment(commission)
                });

                console.log(`Commission of ${commission} PEPE sent to referrer ${userState.referredBy}`);
            }
        }
        userState = doc.data();
        updateUI();
    });
}

// =======================
// Helpers
// =======================
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

// =======================
// UI Update
// =======================
function updateUI() {
    document.getElementById('home-username').textContent = userState.username || "User";
    document.getElementById('balance-home').textContent = Math.floor(userState.balance || 0);
    document.getElementById('profile-name').textContent = userState.username || "User";
    document.getElementById('profile-balance').textContent = Math.floor(userState.balance || 0);
    document.getElementById('total-refers').textContent = userState.referrals?.length || 0;
    document.getElementById('refer-count').textContent = userState.referrals?.length || 0;
    document.getElementById('refer-earnings').textContent = Math.floor(userState.referralEarnings || 0);
    document.getElementById('referral-link').value = `https://t.me/TaskItUpBot?start=${telegramUserId}`;
}

// =======================
// App Entry
// =======================
document.addEventListener('DOMContentLoaded', () => {
    if (window.Telegram && window.Telegram.WebApp) {
        Telegram.WebApp.ready();
        const initData = window.Telegram.WebApp.initDataUnsafe || {};
        const tgUser = initData.user || null;
        if (tgUser && initData.start_param) {
            tgUser.start_param = initData.start_param;
        }
        initializeApp(tgUser);
    } else {
        console.warn("Telegram script not found. Running in browser test mode.");
        initializeApp(null);
    }
});
