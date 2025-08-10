document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const SUPABASE_URL = 'https://edtghdbpocjrlgwstzoj.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkdGdoZGJwb2Nqcmxnd3N0em9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4MDEzMjQsImV4cCI6MjA3MDM3NzMyNH0.t3auZ04WivtssUq6w-G8GStE8nsXjV5AxvsSNGQPmac';
    const BOT_USERNAME = "TaskItUpBot";
    const DAILY_TASK_LIMIT = 40;

    // --- INITIALIZE LIBRARIES ---
    const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
    if (tg) tg.expand();

    let currentUserState = {};
    let telegramUserId = null;
    let realtimeUserChannel = null;
    let realtimeWithdrawalsChannel = null;

    // --- RENDER FUNCTIONS (kept identical to original for UI) ---
    function renderAppStructure() {
        document.getElementById('app-container').innerHTML = `<div id="loading-overlay" class="loading-overlay active"><div class="spinner"></div></div> <div id="home-tab" class="tab-content"></div> <div id="earn-tab" class="tab-content"></div> <div id="withdraw-tab" class="tab-content"></div> <div id="profile-tab" class="tab-content"></div> <button class="refer-fab" id="open-refer-modal-btn" style="display: none;"><i data-feather="gift"></i></button> <div id="refer-modal" class="modal-overlay"></div>`;
        document.querySelector('.nav-bar').innerHTML = `<a href="#" class="nav-item active" data-tab="home-tab"><i data-feather="home"></i><span>Home</span></a> <a href="#" class="nav-item" data-tab="earn-tab"><i data-feather="dollar-sign"></i><span>Earn</span></a> <a href="#" class="nav-item" data-tab="withdraw-tab"><i data-feather="credit-card"></i><span>Withdraw</span></a> <a href="#" class="nav-item" data-tab="profile-tab"><i data-feather="user"></i><span>Profile</span></a>`;
    }

    function renderAllTabs() {
        document.getElementById('home-tab').innerHTML = `<header class="header"><div class="user-info"><p class="welcome-text">Welcome,</p><h2 class="username" id="home-username">User</h2></div><img src="https://i.pravatar.cc/100" alt="User Profile" id="home-profile-pic" class="profile-pic"></header><div class="main-balance-card"><p>Total Balance</p><h1 class="balance-amount"><span id="balance-home">0</span> <span class="currency">PEPE</span></h1></div><div class="stats-grid"><div class="stat-box"><i data-feather="eye" class="icon"></i><p>Ads Watched (Today)</p><h3 id="ads-watched-today">0</h3></div><div class="stat-box"><i data-feather="clock" class="icon"></i><p>Ads Left Today</p><h3 id="ads-left-today">40</h3></div></div><div class="bonus-section"><h3 class="section-title">Bonus Points</h3><div class="task-card" id="task-channel_1" data-url="https://t.me/taskupofficial"><div class="task-info"><p class="task-title">Join Official Channel</p><p class="task-reward">+300 PEPE</p></div><div class="task-buttons"><button class="join-btn"><i data-feather="send"></i> Join</button><button class="verify-btn" disabled>Verify</button></div><div class="task-done"><i data-feather="check"></i> Done</div></div></div>`;
        document.getElementById('earn-tab').innerHTML = `<h2 class="page-title">Earn Rewards</h2><div class="earn-task-card"><h3 class="card-title">Today's Ad Tasks</h3><div class="task-progress-info"><p>Completed: <span id="tasks-completed-text">0 / 40</span></p></div><div class="progress-bar-container"><div class="progress-bar" id="task-progress-bar"></div></div><p class="reward-info">Get <span class="reward-amount">250 PEPE</span> for each ad view.</p><button class="start-task-btn" id="watch-ad-btn"><i data-feather="play-circle"></i> Watch Ad</button></div>`;
        document.getElementById('withdraw-tab').innerHTML = `<h2 class="page-title">Withdraw Funds</h2><div class="available-balance-banner">Available Balance: <span class="bold-text"><span id="withdraw-balance">0</span> PEPE</span></div><div class="withdraw-form-card"><h3 class="card-title">Request Withdrawal</h3><div class="input-group"><label for="withdraw-method">Method</label><select id="withdraw-method"><option value="binancepay">Binance Pay (Min: 10,000 PEPE)</option></select></div><div class="input-group"><label for="withdraw-amount">Amount</label><input type="number" id="withdraw-amount" placeholder="e.g., 15000"></div><div class="input-group"><label for="wallet-id">Binance ID or Email</label><input type="text" id="wallet-id" placeholder="Enter your Binance Pay ID or Email"></div><button class="submit-withdrawal-btn" id="withdraw-btn"><i data-feather="send"></i> Submit Request</button></div><div class="transaction-history"><h3 class="section-title">Recent Withdrawals</h3><div id="history-list"><p class="no-history">You have no withdrawal history yet.</p></div></div>`;
        document.getElementById('profile-tab').innerHTML = `<header class="profile-header"><img src="https://i.pravatar.cc/150" alt="User Profile" id="profile-pic-large" class="profile-pic-large"><h3 id="profile-name">User</h3><p id="telegram-username" class="text-muted">@username</p><p class="profile-balance">Balance: <span id="profile-balance">0</span> PEPE</p></header><div class="profile-stats"><h3 class="section-title">Statistics</h3><div class="stat-item"><p><i data-feather="award"></i> Earned So Far</p><p class="stat-value"><span id="earned-so-far">0</span> PEPE</p></div><div class="stat-item"><p><i data-feather="tv"></i> Total Ads Viewed</p><p class="stat-value" id="total-ads-viewed">0</p></div><div class="stat-item"><p><i data-feather="users"></i> Total Referrals</p><p class="stat-value" id="total-refers'>0</p></div><div class="stat-item"><p><i data-feather="gift"></i> Referral Earnings</p><p class="stat-value"><span id="refer-earnings">0</span> PEPE</p></div></div>`;
        document.getElementById('refer-modal').innerHTML = `<div class="modal-content"><button class="close-btn" id="close-refer-modal-btn"><i data-feather="x"></i></button><h2 class="modal-title">Refer Friends, Earn 10% More!</h2><div class="referral-stats"><p><strong><span id="refer-count">0</span></strong> Referrals</p><p><strong><span id="popup-refer-earnings">0</span> PEPE</strong> Earned</p></div><div class="referral-link-container"><input type="text" id="referral-link" readonly><button id="copy-referral-btn"><i data-feather="copy"></i></button></div><div class="referral-requirements"><h4>How it works:</h4><ul><li><i data-feather="check-circle"></i> Your friend must join using your unique link.</li><li><i data-feather="check-circle"></i> They must open the app to count as a referral.</li></ul></div></div>`;
    }
    
    // --- MAIN APP LOGIC ---
    async function initializeApp(tgInitData) {
        try {
            renderAppStructure();

            // Normalize input: accept either the unsafe object or an initData string
            const init = tgInitData || (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) || {};

            // 1) Get user object if available
            // init.user when using initDataUnsafe, else try to decode init.initData
            let userObj = null;
            if (init.user) {
                userObj = init.user;
            } else if (init.initData) {
                try {
                    const params = new URLSearchParams(init.initData);
                    const userStr = params.get('user');
                    if (userStr) userObj = JSON.parse(userStr);
                } catch (err) {
                    console.warn('Could not parse initData user param', err);
                }
            }

            // 2) Extract start / referral param (Telegram uses "start" in query string sometimes, or "start_param")
            let startParam = init.start_param || init.startParam || null;
            if (!startParam && init.initData) {
                try {
                    const params = new URLSearchParams(init.initData);
                    startParam = params.get('start') || params.get('start_param') || null;
                } catch (err) {
                    // ignore
                }
            }

            // Stable telegramUserId (string)
            telegramUserId = userObj && userObj.id ? String(userObj.id) : `test_${Date.now()}`;

            // Fetch user record
            const { data: existingUser, error: fetchErr } = await sb.from('users').select('*').eq('telegram_id', telegramUserId).single();

            if (fetchErr && fetchErr.code && fetchErr.code !== 'PGRST116') {
                // Unexpected fetch error
                console.error('Could not fetch user:', fetchErr);
                // continue — we'll try to create
            }

            if (!existingUser) {
                console.log('Creating new user record...');
                const newUserPayload = {
                    telegram_id: telegramUserId,
                    first_name: userObj?.first_name || 'TelegramUser',
                    username: userObj?.username || null,
                    referred_by: startParam || null,
                    balance: 0,
                    total_earned: 0,
                    referral_earnings: 0,
                    total_referrals: 0,
                    ads_watched: 0,
                    total_ads_viewed: 0,
                    join_bonus: false
                };

                const { data: created, error: createErr } = await sb.from('users').insert(newUserPayload).select().single();
                if (createErr) {
                    console.error('Failed to create user:', createErr);
                    return;
                }
                currentUserState = created;

                // If there's a referrer (start param), increment their referral count
                if (startParam) {
                    try {
                        // Try to find referrer by telegram_id = startParam
                        const { data: refUser, error: refFetchErr } = await sb.from('users').select('*').eq('telegram_id', String(startParam)).maybeSingle();
                        if (refFetchErr) {
                            console.warn('Could not fetch referrer:', refFetchErr);
                        } else if (refUser) {
                            const newTotal = (refUser.total_referrals || 0) + 1;
                            const { error: updateErr } = await sb.from('users').update({ total_referrals: newTotal }).eq('telegram_id', String(startParam));
                            if (updateErr) console.warn('Could not increment referrer count via update:', updateErr);
                            else console.log('Referrer incremented via safe UPDATE.');
                        } else {
                            console.log('Referrer not registered yet in DB. No increment performed.');
                        }
                    } catch (err) {
                        console.warn('Error while incrementing referrer', err);
                    }
                }
            } else {
                currentUserState = existingUser;
            }

            // Render UI and wire events
            renderAllTabs();
            updateUI(currentUserState);
            addEventListeners();
            setupRealtimeListeners(); // create realtime subscriptions AFTER telegramUserId is known
            loadWithdrawalHistory();
            // hide loading
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.classList.remove('active');
            document.getElementById('home-tab').classList.add('active');
            const fab = document.getElementById('open-refer-modal-btn');
            if (fab) fab.style.display = 'flex';
        } catch (err) {
            console.error('initializeApp error:', err);
        }
    }
    
    function setupRealtimeListeners() {
        // Cleanup any existing channels
        try {
            if (realtimeUserChannel) sb.removeChannel(realtimeUserChannel);
            if (realtimeWithdrawalsChannel) sb.removeChannel(realtimeWithdrawalsChannel);
        } catch (err) {
            // ignore
        }

        // Subscribe to changes for the current user row
        realtimeUserChannel = sb.channel('public:users')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `telegram_id=eq.${telegramUserId}` }, payload => {
                // payload contains {eventType, table, schema, new, old}
                if (payload && payload.new) {
                    currentUserState = payload.new;
                    updateUI(payload.new);
                }
            })
            .subscribe((status) => {
                // optional: handle subscribe status/logging
                // console.log('user realtime status', status);
            });

        // Subscribe to withdrawals of the current user (so history updates realtime)
        realtimeWithdrawalsChannel = sb.channel('public:withdrawals')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals', filter: `user_id=eq.${telegramUserId}` }, payload => {
                loadWithdrawalHistory();
            })
            .subscribe();
    }

    function updateUI(user) {
        if (!user) return;
        const balance = Math.floor(user.balance || 0).toLocaleString();
        const earned = Math.floor(user.total_earned || 0).toLocaleString();
        const refEarnings = Math.floor(user.referral_earnings || 0).toLocaleString();
        const adsToday = user.ads_watched || 0;
        
        document.getElementById('home-username').textContent = user.first_name || 'User';
        document.getElementById('profile-name').textContent = user.first_name || 'User';
        document.getElementById('telegram-username').textContent = user.username ? `@${user.username}` : '@username';
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
        if (watchAdBtn) {
            watchAdBtn.disabled = adsToday >= DAILY_TASK_LIMIT;
            watchAdBtn.innerHTML = adsToday >= DAILY_TASK_LIMIT ? '<i data-feather="check-circle"></i> All tasks done' : '<i data-feather="play-circle"></i> Watch Ad';
        }
        // Referral link
        const referralInput = document.getElementById('referral-link');
        if (referralInput) referralInput.value = `https://t.me/${BOT_USERNAME}?start=${telegramUserId}`;

        document.getElementById('refer-count').textContent = user.total_referrals || 0;
        document.getElementById('popup-refer-earnings').textContent = refEarnings;
        
        const taskCard = document.getElementById('task-channel_1');
        if (taskCard) {
            if (user.join_bonus) taskCard.classList.add('completed');
            else taskCard.classList.remove('completed');
        }
        feather.replace();
    }
    
    async function loadWithdrawalHistory() {
        try {
            const { data } = await sb.from('withdrawals').select('*').eq('user_id', telegramUserId).order('created_at', { ascending: false });
            const historyList = document.getElementById('history-list');
            if (!historyList) return;
            if (data && data.length > 0) {
                historyList.innerHTML = data.map(w => `<div class="history-item ${w.status}"><div class="history-details"><div class="history-amount">${w.amount.toLocaleString()} PEPE</div><div class="history-date">${new Date(w.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div></div><div class="history-status">${w.status}</div></div>`).join('');
            } else {
                historyList.innerHTML = `<p class="no-history">You have no withdrawal history yet.</p>`;
            }
        } catch (err) {
            console.error('loadWithdrawalHistory error', err);
        }
    }

    function addEventListeners() {
        // Nav
        document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', (e) => {
            e.preventDefault(); const tabName = e.currentTarget.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const tabEl = document.getElementById(tabName);
            if (tabEl) tabEl.classList.add('active');
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            e.currentTarget.classList.add('active');
        }));

        // Modal open/close
        const openReferBtn = document.getElementById('open-refer-modal-btn');
        if (openReferBtn) openReferBtn.addEventListener('click', () => { document.getElementById('refer-modal').style.display = 'flex'; });
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'close-refer-modal-btn') document.getElementById('refer-modal').style.display = 'none';
            if (e.target && e.target.id === 'refer-modal') document.getElementById('refer-modal').style.display = 'none';
        });

        // Watch ad RPC
        const watchBtn = document.getElementById('watch-ad-btn');
        if (watchBtn) watchBtn.addEventListener('click', async (e) => {
            const button = e.currentTarget;
            if (button.disabled) return;
            button.disabled = true;
            if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
            
            try {
                const { data: updatedUser, error } = await sb.rpc('watch_ad', { user_id: telegramUserId });
                if (error) {
                    if (tg && tg.showAlert) tg.showAlert(error.message || 'Error watching ad.');
                    console.warn('watch_ad RPC error', error);
                }
                if (updatedUser) updateUI(updatedUser);
            } catch (err) {
                console.error('watch-ad error', err);
            } finally {
                // re-enable; realtime update will keep UI consistent
                setTimeout(() => { if (button) button.disabled = false; }, 1200);
            }
        });

        // Copy referral link
        const copyBtn = document.getElementById('copy-referral-btn');
        if (copyBtn) copyBtn.addEventListener('click', (e) => {
            const referralInput = document.getElementById('referral-link');
            if (!referralInput) return;
            navigator.clipboard.writeText(referralInput.value).then(() => {
                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
                const btn = e.currentTarget; const originalIcon = btn.innerHTML;
                btn.innerHTML = '<i data-feather="check"></i>'; feather.replace();
                setTimeout(() => { btn.innerHTML = originalIcon; feather.replace(); }, 1500);
            });
        });

        // Bonus task join/verify
        const bonusTaskCard = document.getElementById('task-channel_1');
        if (bonusTaskCard) {
            const joinBtn = bonusTaskCard.querySelector('.join-btn');
            const verifyBtn = bonusTaskCard.querySelector('.verify-btn');
            if (joinBtn) joinBtn.addEventListener('click', (e) => {
                const url = e.currentTarget.closest('.task-card').dataset.url;
                if (tg && tg.openTelegramLink) tg.openTelegramLink(url);
                else window.open(url, '_blank');
                if (verifyBtn) verifyBtn.disabled = false;
            });
            if (verifyBtn) verifyBtn.addEventListener('click', async (e) => {
                if (currentUserState.join_bonus) { if (tg && tg.showAlert) tg.showAlert("You've already claimed this bonus."); return; }
                e.currentTarget.disabled = true;
                try {
                    const { data: updatedUser, error } = await sb.rpc('claim_bonus', { user_id: telegramUserId });
                    if (error) console.error("Claim bonus error:", error);
                    if (updatedUser) {
                        if (tg && tg.showAlert) tg.showAlert('Bonus of 300 PEPE claimed!');
                        updateUI(updatedUser);
                    }
                } catch (err) {
                    console.error('claim bonus error', err);
                }
            });
        }

        // Withdraw
        const withdrawBtn = document.getElementById('withdraw-btn');
        if (withdrawBtn) withdrawBtn.addEventListener('click', async () => {
            const amount = parseInt(document.getElementById('withdraw-amount').value);
            const address = document.getElementById('wallet-id').value.trim();
            if (!amount || !address || amount < 10000) { if (tg && tg.showAlert) tg.showAlert('Please enter a valid amount (min 10,000) and your wallet ID.'); return; }
            if (amount > (currentUserState.balance || 0)) { if (tg && tg.showAlert) tg.showAlert('Insufficient balance.'); return; }
            try {
                const { error } = await sb.rpc('request_withdrawal', { p_user_id: telegramUserId, p_amount: amount, p_address: address });
                if (error) { if (tg && tg.showAlert) tg.showAlert(error.message || 'Withdrawal request failed.'); }
                else { if (tg && tg.showAlert) tg.showAlert('Withdrawal request submitted!'); document.getElementById('withdraw-amount').value = ''; document.getElementById('wallet-id').value = ''; }
            } catch (err) {
                console.error('request_withdrawal error', err);
            }
        });
    }

    // --- APP ENTRY POINT ---
    // Prefer initDataUnsafe when available
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
        try { Telegram.WebApp.ready(); } catch (e) { /* ignore */ }
        initializeApp(window.Telegram.WebApp.initDataUnsafe);
    } else {
        // Browser/test mode: pass empty object
        console.warn("Telegram WebApp not present or initDataUnsafe missing. Running in browser test mode.");
        initializeApp({});
    }
});
