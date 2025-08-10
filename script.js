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

    // --- DOM TEMPLATES & DYNAMIC INJECTION ---
    const appContainer = document.getElementById('app-container');
    const navBar = document.querySelector('.nav-bar');

    // Inject HTML structure into the body. This keeps the initial HTML file clean.
    appContainer.innerHTML = `
        <div id="home-tab" class="tab-content"></div>
        <div id="earn-tab" class="tab-content"></div>
        <div id="withdraw-tab" class="tab-content"></div>
        <div id="profile-tab" class="tab-content"></div>
        <button class="refer-fab" id="open-refer-modal-btn"><i data-feather="gift"></i></button>
        <div id="refer-modal" class="modal-overlay"></div>`;
    
    navBar.innerHTML = `
        <a href="#" class="nav-item active" data-tab="home-tab"><i data-feather="home"></i><span>Home</span></a>
        <a href="#" class="nav-item" data-tab="earn-tab"><i data-feather="dollar-sign"></i><span>Earn</span></a>
        <a href="#" class="nav-item" data-tab="withdraw-tab"><i data-feather="credit-card"></i><span>Withdraw</span></a>
        <a href="#" class="nav-item" data-tab="profile-tab"><i data-feather="user"></i><span>Profile</span></a>`;

    let currentUserState = {};
    let telegramUserId = null;

    // --- RENDER FUNCTIONS (To build the UI dynamically) ---
    function renderAllTabs() {
        document.getElementById('home-tab').innerHTML = `
            <header class="header"><div class="user-info"><p class="welcome-text">Welcome,</p><h2 class="username" id="home-username">User</h2></div><img src="https://i.pravatar.cc/100" alt="User Profile" id="home-profile-pic" class="profile-pic"></header>
            <div class="main-balance-card"><p>Total Balance</p><h1 class="balance-amount"><span id="balance-home">0</span> <span class="currency">PEPE</span></h1></div>
            <div class="stats-grid"><div class="stat-box"><i data-feather="eye" class="icon"></i><p>Ads Watched (Today)</p><h3 id="ads-watched-today">0</h3></div><div class="stat-box"><i data-feather="clock" class="icon"></i><p>Ads Left Today</p><h3 id="ads-left-today">40</h3></div></div>
            <div class="bonus-section"><h3 class="section-title">Bonus Points</h3><div class="task-card" id="task-channel_1" data-url="https://t.me/taskupofficial"><div class="task-info"><p class="task-title">Join Official Channel</p><p class="task-reward">+300 PEPE</p></div><div class="task-buttons"><button class="join-btn"><i data-feather="send"></i> Join</button><button class="verify-btn" disabled>Verify</button></div><div class="task-done"><i data-feather="check"></i> Done</div></div></div>`;
        
        document.getElementById('earn-tab').innerHTML = `<h2 class="page-title">Earn Rewards</h2><div class="earn-task-card"><h3 class="card-title">Today's Ad Tasks</h3><div class="task-progress-info"><p>Completed: <span id="tasks-completed-text">0 / 40</span></p></div><div class="progress-bar-container"><div class="progress-bar" id="task-progress-bar"></div></div><p class="reward-info">Get <span class="reward-amount">250 PEPE</span> for each ad view.</p><button class="start-task-btn" id="watch-ad-btn"><i data-feather="play-circle"></i> Watch Ad</button></div>`;
        
        document.getElementById('withdraw-tab').innerHTML = `<h2 class="page-title">Withdraw Funds</h2><div class="available-balance-banner">Available Balance: <span class="bold-text"><span id="withdraw-balance">0</span> PEPE</span></div><div class="withdraw-form-card"><h3 class="card-title">Request Withdrawal</h3><div class="input-group"><label for="withdraw-method">Method</label><select id="withdraw-method"><option value="binancepay">Binance Pay (Min: 10,000 PEPE)</option></select></div><div class="input-group"><label for="withdraw-amount">Amount</label><input type="number" id="withdraw-amount" placeholder="e.g., 15000"></div><div class="input-group"><label for="wallet-id">Binance ID or Email</label><input type="text" id="wallet-id" placeholder="Enter your Binance Pay ID or Email"></div><button class="submit-withdrawal-btn" id="withdraw-btn"><i data-feather="send"></i> Submit Request</button></div><div class="transaction-history"><h3 class="section-title">Recent Withdrawals</h3><div id="history-list"><p class="no-history">You have no withdrawal history yet.</p></div></div>`;
        
        document.getElementById('profile-tab').innerHTML = `<header class="profile-header"><img src="https://i.pravatar.cc/150" alt="User Profile" id="profile-pic-large" class="profile-pic-large"><h3 id="profile-name">User</h3><p id="telegram-username" class="text-muted">@username</p><p class="profile-balance">Balance: <span id="profile-balance">0</span> PEPE</p></header><div class="profile-stats"><h3 class="section-title">Statistics</h3><div class="stat-item"><p><i data-feather="award"></i> Earned So Far</p><p class="stat-value"><span id="earned-so-far">0</span> PEPE</p></div><div class="stat-item"><p><i data-feather="tv"></i> Total Ads Viewed</p><p class="stat-value" id="total-ads-viewed">0</p></div><div class="stat-item"><p><i data-feather="users"></i> Total Referrals</p><p class="stat-value" id="total-refers">0</p></div><div class="stat-item"><p><i data-feather="gift"></i> Referral Earnings</p><p class="stat-value"><span id="refer-earnings">0</span> PEPE</p></div></div>`;
        
        document.getElementById('refer-modal').innerHTML = `<div class="modal-content"><button class="close-btn" id="close-refer-modal-btn"><i data-feather="x"></i></button><h2 class="modal-title">Refer Friends, Earn 10% More!</h2><div class="referral-stats"><p><strong><span id="refer-count">0</span></strong> Referrals</p><p><strong><span id="popup-refer-earnings">0</span> PEPE</strong> Earned</p></div><div class="referral-link-container"><input type="text" id="referral-link" readonly><button id="copy-referral-btn"><i data-feather="copy"></i></button></div><div class="referral-requirements"><h4>How it works:</h4><ul><li><i data-feather="check-circle"></i> Your friend must join using your unique link.</li><li><i data-feather="check-circle"></i> They must open the app to count as a referral.</li></ul></div></div>`;
        
        document.getElementById('home-tab').classList.add('active');
        feather.replace();
    }
    
    // --- MAIN APP LOGIC ---
    async function initializeApp(tgUser, tgInitData) {
        renderAllTabs();
        addEventListeners();
        
        telegramUserId = tgUser ? tgUser.id.toString() : `test_${Date.now()}`;
        
        const { data: user, error } = await sb.from('users').select('*').eq('telegram_id', telegramUserId).single();
        if (error && error.code !== 'PGRST116') { // PGRST116 means "no rows returned", which is expected for a new user.
            console.error('Error fetching user:', error);
            tg.showAlert('Could not load your profile. Please try again later.');
            return;
        }

        if (!user) {
            console.log("New user detected, creating account...");
            const referredBy = tgInitData.start_param || null;
            const newUser = { telegram_id: telegramUserId, first_name: tgUser?.first_name || 'Test User', username: tgUser?.username, referred_by: referredBy };
            
            const { data: createdUser, error: creationError } = await sb.from('users').insert(newUser).select().single();
            if (creationError) {
                console.error("Fatal error: Failed to create user account.", creationError);
                tg.showAlert('Could not create your account. Please try restarting the app.');
                return;
            }

            currentUserState = createdUser;
            if (referredBy) {
                console.log(`User was referred by ${referredBy}. Incrementing referrer's count.`);
                await sb.rpc('increment_referrals', { user_id: referredBy });
            }
        } else {
            currentUserState = user;
        }

        updateUI(currentUserState);
        listenForRealtimeChanges();
        loadWithdrawalHistory();
    }
    
    function listenForRealtimeChanges() {
        sb.channel(`public:users:telegram_id=eq.${telegramUserId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, payload => {
                console.log('Realtime user update received:', payload.new);
                currentUserState = payload.new;
                updateUI(payload.new);
          }).subscribe();
        
        sb.channel(`public:withdrawals:user_id=eq.${telegramUserId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, loadWithdrawalHistory)
          .subscribe();
    }

    function updateUI(user) {
        if (!user) return;
        const balance = Math.floor(user.balance || 0).toLocaleString();
        const earned = Math.floor(user.total_earned || 0).toLocaleString();
        const refEarnings = Math.floor(user.referral_earnings || 0).toLocaleString();
        const adsToday = user.ads_watched || 0;
        
        document.getElementById('home-username').textContent = user.first_name;
        document.getElementById('profile-name').textContent = user.first_name;
        document.getElementById('telegram-username').textContent = `@${user.username || 'N/A'}`;
        document.getElementById('balance-home').textContent = balance;
        document.getElementById('profile-balance').textContent = balance;
        document.getElementById('withdraw-balance').textContent = balance;
        document.getElementById('earned-so-far').textContent = earned;
        document.getElementById('total-ads-viewed').textContent = user.total_ads_viewed || 0;
        document.getElementById('total-refers').textContent = user.total_referrals || 0;
        document.getElementById('refer-earnings').textContent = refEarnings;
        document.getElementById('ads-watched-today').textContent = adsToday;
        document.getElementById('ads-left-today').textContent = DAILY_TASK_LIMIT - adsToday;
        document.getElementById('tasks-completed-text').textContent = `${adsToday} / ${DAILY_TASK_LIMIT}`;
        document.getElementById('task-progress-bar').style.width = `${(adsToday / DAILY_TASK_LIMIT) * 100}%`;
        const watchAdBtn = document.getElementById('watch-ad-btn');
        watchAdBtn.disabled = adsToday >= DAILY_TASK_LIMIT;
        watchAdBtn.innerHTML = adsToday >= DAILY_TASK_LIMIT ? '<i data-feather="check-circle"></i> All tasks done' : '<i data-feather="play-circle"></i> Watch Ad';
        document.getElementById('referral-link').value = `https://t.me/${BOT_USERNAME}?start=${telegramUserId}`;
        document.getElementById('refer-count').textContent = user.total_referrals || 0;
        document.getElementById('popup-refer-earnings').textContent = refEarnings;
        
        const taskCard = document.getElementById('task-channel_1');
        if (user.join_bonus) taskCard.classList.add('completed');
        feather.replace();
    }
    
    async function loadWithdrawalHistory() {
        const { data, error } = await sb.from('withdrawals').select('*').eq('user_id', telegramUserId).order('created_at', { ascending: false });
        if (error) return console.error("Error loading withdrawal history:", error);
        
        const historyList = document.getElementById('history-list');
        if (data && data.length > 0) {
            historyList.innerHTML = data.map(w => `<div class="history-item ${w.status}"><div class="history-details"><div class="history-amount">${w.amount.toLocaleString()} PEPE</div><div class="history-date">${new Date(w.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div></div><div class="history-status">${w.status}</div></div>`).join('');
        } else {
            historyList.innerHTML = `<p class="no-history">You have no withdrawal history yet.</p>`;
        }
    }

    // --- EVENT LISTENERS (Setup once after initial render) ---
    function addEventListeners() {
        document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', (e) => {
            e.preventDefault(); const tabName = e.currentTarget.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(tabName).classList.add('active');
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            e.currentTarget.classList.add('active');
        }));

        document.getElementById('open-refer-modal-btn').addEventListener('click', () => { document.getElementById('refer-modal').style.display = 'flex'; });
        document.getElementById('close-refer-modal-btn').addEventListener('click', () => { document.getElementById('refer-modal').style.display = 'none'; });
        document.getElementById('refer-modal').addEventListener('click', (e) => { if(e.target.id === 'refer-modal') document.getElementById('refer-modal').style.display = 'none'; });
        
        document.getElementById('watch-ad-btn').addEventListener('click', async (e) => {
            if(e.currentTarget.disabled) return;
            e.currentTarget.disabled = true;
            tg.HapticFeedback.impactOccurred('light');
            const { error } = await sb.rpc('watch_ad', { user_id: telegramUserId });
            if (error) {
                tg.showAlert('You have reached your daily ad limit.');
                console.error("Watch ad error:", error);
            }
        });

        document.getElementById('copy-referral-btn').addEventListener('click', (e) => {
            navigator.clipboard.writeText(document.getElementById('referral-link').value).then(() => {
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
            const { error } = await sb.rpc('claim_bonus', { user_id: telegramUserId });
            if(error) console.error("Claim bonus error:", error);
            else tg.showAlert('Bonus of 300 PEPE claimed!');
        });

        document.getElementById('withdraw-btn').addEventListener('click', async () => {
            const amount = parseInt(document.getElementById('withdraw-amount').value);
            const address = document.getElementById('wallet-id').value.trim();
            if (!amount || !address || amount < 10000) { tg.showAlert('Please enter a valid amount (min 10,000) and your wallet ID.'); return; }
            if (amount > currentUserState.balance) { tg.showAlert('Insufficient balance.'); return; }
            
            const { error } = await sb.rpc('request_withdrawal', { p_user_id: telegramUserId, p_amount: amount, p_address: address });
            if (error) { tg.showAlert(error.message); console.error("Withdrawal error:", error); } 
            else { tg.showAlert('Withdrawal request submitted!'); document.getElementById('withdraw-amount').value = ''; document.getElementById('wallet-id').value = ''; }
        });
    }

    // --- APP ENTRY POINT ---
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
        Telegram.WebApp.ready();
        initializeApp(window.Telegram.WebApp.initDataUnsafe.user, window.Telegram.WebApp.initDataUnsafe);
    } else {
        console.warn("Telegram script not found. Running in browser test mode.");
        initializeApp(null, {});
    }
});
