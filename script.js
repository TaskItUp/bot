document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const SUPABASE_URL = 'https://edtghdbpocjrlgwstzoj.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkdGdoZGJwb2Nqcmxnd3N0em9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4MDEzMjQsImV4cCI6MjA3MDM3NzMyNH0.t3auZ04WivtssUq6w-G8GStE8nsXjV5AxvsSNGQPmac';
    const BOT_USERNAME = "TaskItUpBot";
    const DAILY_TASK_LIMIT = 40;

    // --- INITIALIZE LIBRARIES ---
    const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const tg = window.Telegram.WebApp;
    tg.expand();
    feather.replace();

    // --- DOM ELEMENT CACHE ---
    const elements = {
        homeUsername: document.getElementById('home-username'), homeProfilePic: document.getElementById('home-profile-pic'),
        balanceHome: document.getElementById('balance-home'), adsWatchedToday: document.getElementById('ads-watched-today'),
        adsLeftToday: document.getElementById('ads-left-today'), tasksCompletedText: document.getElementById('tasks-completed-text'),
        taskProgressBar: document.getElementById('task-progress-bar'), watchAdBtn: document.getElementById('watch-ad-btn'),
        withdrawBalance: document.getElementById('withdraw-balance'), withdrawAmount: document.getElementById('withdraw-amount'),
        walletId: document.getElementById('wallet-id'), withdrawBtn: document.getElementById('withdraw-btn'),
        historyList: document.getElementById('history-list'), profilePicLarge: document.getElementById('profile-pic-large'),
        profileName: document.getElementById('profile-name'), telegramUsername: document.getElementById('telegram-username'),
        profileBalance: document.getElementById('profile-balance'), earnedSoFar: document.getElementById('earned-so-far'),
        totalAdsViewed: document.getElementById('total-ads-viewed'), totalRefers: document.getElementById('total-refers'),
        referEarnings: document.getElementById('refer-earnings'), referModal: document.getElementById('refer-modal'),
        referralLink: document.getElementById('referral-link'), referCount: document.getElementById('refer-count'),
        popupReferEarnings: document.getElementById('popup-refer-earnings'), navItems: document.querySelectorAll('.nav-item'),
    };

    let currentUserState = {};
    let telegramUserId = null;

    // --- MAIN APP LOGIC ---
    async function initializeUser(tgUser, tgInitData) {
        telegramUserId = tgUser ? tgUser.id.toString() : `test_${Date.now()}`;
        
        let { data: user } = await sb.from('users').select('*').eq('telegram_id', telegramUserId).single();

        // This block runs ONLY for new users.
        if (!user) {
            console.log("New user detected, creating account...");

            // --- THIS IS THE CRITICAL FIX ---
            // It correctly reads `start_param` from the main initData object.
            const referredBy = tgInitData.start_param || new URLSearchParams(window.location.search).get('start');

            const newUser = { 
                telegram_id: telegramUserId, 
                first_name: tgUser ? tgUser.first_name : 'Test', 
                username: tgUser ? tgUser.username : 'testuser', 
                referred_by: referredBy || null 
            };
            
            const { data: createdUser, error: creationError } = await sb.from('users').insert(newUser).select().single();
            if (creationError) {
                console.error("Failed to create user:", creationError);
                return;
            }
            user = createdUser;
            
            // If there was a referrer, call the database function to give them credit.
            if (referredBy) {
                console.log(`New user was referred by: ${referredBy}. Incrementing referrer's count.`);
                await sb.rpc('increment_referrals', { user_id: referredBy });
            }
        }

        currentUserState = user;
        updateUI(user);
        listenForRealtimeChanges();
        loadWithdrawalHistory();
    }
    
    function listenForRealtimeChanges() {
        // Listens for changes to the CURRENT user's data (e.g., their balance increases)
        sb.channel(`public:users:telegram_id=eq.${telegramUserId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `telegram_id=eq.${telegramUserId}` }, payload => {
            currentUserState = payload.new;
            updateUI(payload.new);
        }).subscribe();

        // Listens for changes to the CURRENT user's withdrawal history
        sb.channel(`public:withdrawals:user_id=eq.${telegramUserId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals', filter: `user_id=eq.${telegramUserId}` }, loadWithdrawalHistory).subscribe();
    }

    function updateUI(user) {
        if (!user) return;
        const balance = Math.floor(user.balance || 0).toLocaleString();
        const earned = Math.floor(user.total_earned || 0).toLocaleString();
        const refEarnings = Math.floor(user.referral_earnings || 0).toLocaleString();
        const adsToday = user.ads_watched || 0;
        
        elements.homeUsername.textContent = user.first_name;
        elements.profileName.textContent = user.first_name;
        elements.telegramUsername.textContent = `@${user.username || 'N/A'}`;
        elements.balanceHome.textContent = balance;
        elements.profileBalance.textContent = balance;
        elements.withdrawBalance.textContent = balance;
        elements.earnedSoFar.textContent = earned;
        elements.totalAdsViewed.textContent = user.total_ads_viewed || 0;
        elements.totalRefers.textContent = user.total_referrals || 0;
        elements.referEarnings.textContent = refEarnings;
        elements.adsWatchedToday.textContent = adsToday;
        elements.adsLeftToday.textContent = DAILY_TASK_LIMIT - adsToday;
        elements.tasksCompletedText.textContent = `${adsToday} / ${DAILY_TASK_LIMIT}`;
        elements.taskProgressBar.style.width = `${(adsToday / DAILY_TASK_LIMIT) * 100}%`;
        elements.watchAdBtn.disabled = adsToday >= DAILY_TASK_LIMIT;
        elements.watchAdBtn.innerHTML = adsToday >= DAILY_TASK_LIMIT ? '<i data-feather="check-circle"></i> All tasks done' : '<i data-feather="play-circle"></i> Watch Ad';
        elements.referralLink.value = `https://t.me/${BOT_USERNAME}?start=${telegramUserId}`;
        elements.referCount.textContent = user.total_referrals || 0;
        elements.popupReferEarnings.textContent = refEarnings;
        
        const joinBonusDone = (user.join_bonus || false);
        const taskCard = document.getElementById('task-channel_1');
        if(joinBonusDone) taskCard.classList.add('completed');
        
        feather.replace();
    }
    
    async function loadWithdrawalHistory() {
        const { data } = await sb.from('withdrawals').select('*').eq('user_id', telegramUserId).order('created_at', { ascending: false });
        if (data && data.length > 0) {
            elements.historyList.innerHTML = data.map(w => `<div class="history-item ${w.status}"><div class="history-details"><div class="history-amount">${w.amount.toLocaleString()} PEPE</div><div class="history-date">${new Date(w.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div></div><div class="history-status">${w.status}</div></div>`).join('');
        } else { elements.historyList.innerHTML = `<p class="no-history">You have no withdrawal history yet.</p>`; }
    }

    // --- EVENT LISTENERS ---
    elements.navItems.forEach(item => item.addEventListener('click', (e) => {
        e.preventDefault(); const tabName = e.currentTarget.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(tabName).classList.add('active');
        elements.navItems.forEach(i => i.classList.remove('active'));
        e.currentTarget.classList.add('active');
    }));

    document.getElementById('open-refer-modal-btn').addEventListener('click', () => { elements.referModal.style.display = 'flex'; });
    document.getElementById('close-refer-modal-btn').addEventListener('click', () => { elements.referModal.style.display = 'none'; });
    elements.referModal.addEventListener('click', (e) => { if(e.target === elements.referModal) elements.referModal.style.display = 'none'; });
    
    elements.watchAdBtn.addEventListener('click', async (e) => {
        if(e.currentTarget.disabled) return;
        e.currentTarget.disabled = true;
        tg.HapticFeedback.impactOccurred('light');
        const { error } = await sb.rpc('watch_ad', { user_id: telegramUserId });
        if(error) tg.showAlert('You have reached your daily ad limit.');
    });

    document.getElementById('copy-referral-btn').addEventListener('click', (e) => {
        navigator.clipboard.writeText(elements.referralLink.value).then(() => {
            tg.HapticFeedback.notificationOccurred('success');
            const btn = e.currentTarget; const originalIcon = btn.innerHTML;
            btn.innerHTML = '<i data-feather="check"></i>'; feather.replace();
            setTimeout(() => { btn.innerHTML = originalIcon; feather.replace(); }, 1500);
        });
    });
    
    const bonusTaskCard = document.getElementById('task-channel_1');
    bonusTaskCard.querySelector('.join-btn').addEventListener('click', (e) => {
        tg.openTelegramLink(e.currentTarget.parentElement.parentElement.dataset.url);
        bonusTaskCard.querySelector('.verify-btn').disabled = false;
    });
    bonusTaskCard.querySelector('.verify-btn').addEventListener('click', async (e) => {
        if (currentUserState.join_bonus) { tg.showAlert("You've already claimed this bonus."); return; }
        e.currentTarget.disabled = true;
        await sb.rpc('claim_bonus', { user_id: telegramUserId });
        tg.showAlert('Bonus of 300 PEPE claimed!');
    });
    
    elements.withdrawBtn.addEventListener('click', async () => {
        const amount = parseInt(elements.withdrawAmount.value);
        const address = elements.walletId.value.trim();
        if (!amount || !address || amount < 10000) { tg.showAlert('Please enter a valid amount (min 10,000) and your wallet ID.'); return; }
        if (amount > currentUserState.balance) { tg.showAlert('Insufficient balance.'); return; }
        
        const { error } = await sb.rpc('request_withdrawal', { p_user_id: telegramUserId, p_amount: amount, p_address: address });
        if(error) { tg.showAlert(error.message); } 
        else { tg.showAlert('Withdrawal request submitted successfully!'); elements.withdrawAmount.value = ''; elements.walletId.value = ''; }
    });

    // --- APP ENTRY POINT ---
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
        Telegram.WebApp.ready();
        // Pass the entire initDataUnsafe object to the initialization function
        initializeUser(window.Telegram.WebApp.initDataUnsafe.user, window.Telegram.WebApp.initDataUnsafe);
    } else {
        console.warn("Telegram script not found. Running in browser test mode.");
        initializeUser(null, {}); // Pass null and an empty object for testing
    }
});