// --- [DATABASE & APP INITIALIZATION] ---
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

// --- [GLOBAL STATE] ---
let userState = {};
let telegramUserId = null;
let isInitialized = false;

const DAILY_TASK_LIMIT = 40;
const AD_REWARD = 250;
const WITHDRAWAL_MINIMUMS = { binancepay: 10000 };

// --- [APP INIT] ---
function initializeApp(tgUser) {
    telegramUserId = tgUser ? tgUser.id.toString() : getFakeUserIdForTesting();
    const userRef = db.collection('users').doc(telegramUserId);

    userRef.onSnapshot((doc) => {
        if (doc.exists) {
            userState = doc.data();
            updateUI();
            if (!isInitialized) {
                setupTaskButtonListeners();
                listenForWithdrawalHistory();
                isInitialized = true;
            }
        } else {
            console.error("User not found in Firestore. Make sure bot backend adds them.");
        }
    });
}

function getFakeUserIdForTesting() {
    let storedId = localStorage.getItem('localAppUserId');
    if (storedId) return storedId;
    const newId = 'test_user_' + Date.now().toString(36);
    localStorage.setItem('localAppUserId', newId);
    return newId;
}

// --- [UI UPDATE] ---
function updateUI() {
    document.querySelectorAll('.profile-pic, .profile-pic-large').forEach(img => {
        if (userState.profilePicUrl) img.src = userState.profilePicUrl;
    });

    document.getElementById('home-username').textContent = userState.username || "User";
    document.getElementById('profile-name').textContent = userState.username || "User";
    document.getElementById('telegram-username').textContent = userState.telegramUsername || "@username";

    const balance = Math.floor(userState.balance || 0).toLocaleString();
    document.getElementById('balance-home').textContent = balance;
    document.getElementById('withdraw-balance').textContent = balance;
    document.getElementById('profile-balance').textContent = balance;

    document.getElementById('ads-watched-today').textContent = userState.tasksCompletedToday || 0;
    document.getElementById('ads-left-today').textContent = DAILY_TASK_LIMIT - (userState.tasksCompletedToday || 0);

    const tasksCompleted = userState.tasksCompletedToday || 0;
    document.getElementById('tasks-completed').textContent = `${tasksCompleted} / ${DAILY_TASK_LIMIT}`;
    document.getElementById('task-progress-bar').style.width = `${(tasksCompleted / DAILY_TASK_LIMIT) * 100}%`;

    const taskButton = document.getElementById('start-task-button');
    taskButton.disabled = tasksCompleted >= DAILY_TASK_LIMIT;
    taskButton.innerHTML = tasksCompleted >= DAILY_TASK_LIMIT
        ? '<i class="fas fa-check-circle"></i> All tasks done'
        : '<i class="fas fa-play-circle"></i> Watch Ad';

    document.getElementById('earned-so-far').textContent = Math.floor(userState.totalEarned || 0).toLocaleString();
    document.getElementById('total-ads-viewed').textContent = userState.totalAdsViewed || 0;
    document.getElementById('total-refers').textContent = userState.totalRefers || 0;
    document.getElementById('refer-earnings').textContent = Math.floor(userState.referralEarnings || 0).toLocaleString();
    document.getElementById('refer-count').textContent = userState.totalRefers || 0;
}

// --- [WITHDRAW HISTORY] ---
function renderHistoryItem(withdrawalData) {
    const item = document.createElement('div');
    item.className = `history-item ${withdrawalData.status}`;
    const date = withdrawalData.requestedAt.toDate ? withdrawalData.requestedAt.toDate() : withdrawalData.requestedAt;
    const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    item.innerHTML = `
        <div class="history-details">
            <div class="history-amount">${withdrawalData.amount.toLocaleString()} PEPE</div>
            <div class="history-date">${formattedDate}</div>
        </div>
        <div class="history-status ${withdrawalData.status}">${withdrawalData.status}</div>
    `;
    return item;
}

function listenForWithdrawalHistory() {
    const historyList = document.getElementById('history-list');
    db.collection('withdrawals')
        .where('userId', '==', telegramUserId)
        .orderBy('requestedAt', 'desc')
        .limit(10)
        .onSnapshot(querySnapshot => {
            if (querySnapshot.empty) {
                historyList.innerHTML = '<p class="no-history">You have no withdrawal history yet.</p>';
                return;
            }
            historyList.innerHTML = '';
            querySnapshot.forEach(doc => {
                historyList.appendChild(renderHistoryItem(doc.data()));
            });
        });
}

// --- [TASKS] ---
function setupTaskButtonListeners() {
    document.querySelectorAll('.task-card').forEach(card => {
        const joinBtn = card.querySelector('.join-btn');
        const verifyBtn = card.querySelector('.verify-btn');
        const taskId = card.dataset.taskId;
        const url = card.dataset.url;
        const reward = parseInt(card.dataset.reward);

        if (joinBtn) joinBtn.addEventListener('click', () => handleJoinClick(taskId, url));
        if (verifyBtn) verifyBtn.addEventListener('click', () => handleVerifyClick(taskId, reward));
    });
}

async function handleVerifyClick(taskId, reward) {
    if (userState.joinedBonusTasks.includes(taskId)) {
        alert("You have already completed this task.");
        return;
    }
    const userRef = db.collection('users').doc(telegramUserId);
    await userRef.update({
        balance: firebase.firestore.FieldValue.increment(reward),
        totalEarned: firebase.firestore.FieldValue.increment(reward),
        joinedBonusTasks: firebase.firestore.FieldValue.arrayUnion(taskId)
    });
    alert(`Task verified! You've earned ${reward} PEPE.`);
}

function handleJoinClick(taskId, url) {
    window.open(url, '_blank');
    alert("After joining, return to the app and press 'Verify' to claim your reward.");
}

// --- [ADS] ---
window.completeAdTask = async function () {
    if ((userState.tasksCompletedToday || 0) >= DAILY_TASK_LIMIT) {
        alert("You have completed all ad tasks for today!");
        return;
    }
    await window.show_9685198();
    const userRef = db.collection('users').doc(telegramUserId);
    await userRef.update({
        balance: firebase.firestore.FieldValue.increment(AD_REWARD),
        totalEarned: firebase.firestore.FieldValue.increment(AD_REWARD),
        tasksCompletedToday: firebase.firestore.FieldValue.increment(1),
        totalAdsViewed: firebase.firestore.FieldValue.increment(1),
        lastTaskTimestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert(`Success! ${AD_REWARD} PEPE added.`);
};

// --- [WITHDRAWALS] ---
window.submitWithdrawal = async function () {
    const amount = parseInt(document.getElementById('withdraw-amount').value);
    const method = document.getElementById('withdraw-method').value;
    const walletId = document.getElementById('wallet-id').value.trim();
    const minAmount = WITHDRAWAL_MINIMUMS[method];

    if (isNaN(amount) || amount <= 0 || !walletId) {
        alert('Enter a valid amount and wallet ID.');
        return;
    }
    if (amount < minAmount) {
        alert(`Minimum withdrawal is ${minAmount} PEPE.`);
        return;
    }
    if (amount > userState.balance) {
        alert('Not enough balance.');
        return;
    }

    await db.collection('withdrawals').add({
        userId: telegramUserId,
        username: userState.telegramUsername,
        amount,
        method: "Binance Pay",
        walletId,
        currency: "PEPE",
        status: "pending",
        requestedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await db.collection('users').doc(telegramUserId).update({
        balance: firebase.firestore.FieldValue.increment(-amount)
    });

    alert(`Withdrawal of ${amount.toLocaleString()} PEPE requested.`);
    document.getElementById('withdraw-amount').value = '';
    document.getElementById('wallet-id').value = '';
};

// --- [REFERRAL MODAL] ---
window.openReferModal = function () {
    const referralLink = `https://t.me/YOUR_BOT_USERNAME?start=${telegramUserId}`;
    document.getElementById('referral-link').value = referralLink;
    document.getElementById('refer-modal').style.display = 'flex';
};

window.closeReferModal = function () {
    document.getElementById('refer-modal').style.display = 'none';
};

window.copyReferralLink = function (button) {
    const linkInput = document.getElementById('referral-link');
    navigator.clipboard.writeText(linkInput.value).then(() => {
        const originalIcon = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => button.innerHTML = originalIcon, 1500);
    });
};

window.onclick = function (event) {
    if (event.target == document.getElementById('refer-modal')) closeReferModal();
};

// --- [APP ENTRY] ---
document.addEventListener('DOMContentLoaded', () => {
    if (window.Telegram && window.Telegram.WebApp) {
        Telegram.WebApp.ready();
        initializeApp(window.Telegram.WebApp.initDataUnsafe.user);
    } else {
        initializeApp(null); // test mode
    }
});

