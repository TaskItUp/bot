// script.js - Final fixed version
document.addEventListener('DOMContentLoaded', async () => {
  // -------- CONFIG ----------
  const SUPABASE_URL = 'https://edtghdbpocjrlgwstzoj.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkdGdoZGJwb2Nqcmxnd3N0em9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4MDEzMjQsImV4cCI6MjA3MDM3NzMyNH0.t3auZ04WivtssUq6w-G8GStE8nsXjV5AxvsSNGQPmac';
  const BOT_USERNAME = 'TaskItUpBot';
  const DAILY_TASK_LIMIT = 40;

  // -------- LIBS ----------
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  if (tg && tg.expand) tg.expand();

  // -------- STATE ----------
  let telegramUserId = null;      // string
  let currentUserState = null;    // row from users table
  let usersChannel = null;
  let withdrawalsChannel = null;

  // --------- UTIL: parse Telegram init data robustly ----------
  function extractInitInfo(initUnsafeOrObj) {
    // Accept either Telegram.WebApp.initDataUnsafe object OR a string-like initData
    const init = initUnsafeOrObj || (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) || {};

    let user = null;
    let startParam = null;
    // case: initDataUnsafe object with .user and .start_param
    if (init.user) user = init.user;
    if (init.start_param) startParam = init.start_param;

    // fallback: try to parse initData querystring if provided
    if (!user && init.initData) {
      try {
        const params = new URLSearchParams(init.initData);
        const userStr = params.get('user');
        if (userStr) user = JSON.parse(userStr);
      } catch (e) {
        console.warn('Could not parse initData.user', e);
      }
    }
    if (!startParam && init.initData) {
      try {
        const params = new URLSearchParams(init.initData);
        startParam = params.get('start') || params.get('start_param') || null;
      } catch (e) { /* ignore */ }
    }

    return { user, startParam };
  }

  // --------- UI update function ----------
  function updateUI(user) {
    if (!user) return;
    currentUserState = user;

    const balance = Math.floor(Number(user.balance || 0));
    const totalEarned = Math.floor(Number(user.total_earned || 0));
    const refEarnings = Math.floor(Number(user.referral_earnings || 0));
    const adsToday = Number(user.ads_watched || 0);

    document.getElementById('home-username').textContent = user.first_name || 'User';
    document.getElementById('profile-name').textContent = user.first_name || 'User';
    document.getElementById('telegram-username').textContent = user.username ? `@${user.username}` : '@username';

    document.getElementById('balance-home').textContent = balance.toLocaleString();
    document.getElementById('profile-balance').textContent = balance.toLocaleString();
    document.getElementById('withdraw-balance').textContent = balance.toLocaleString();

    document.getElementById('earned-so-far').textContent = totalEarned.toLocaleString();
    document.getElementById('total-ads-viewed').textContent = (user.total_ads_viewed || 0);
    document.getElementById('total-refers').textContent = (user.total_referrals || 0);
    document.getElementById('refer-earnings').textContent = refEarnings.toLocaleString();

    document.getElementById('ads-watched-today').textContent = adsToday;
    document.getElementById('ads-left-today').textContent = Math.max(DAILY_TASK_LIMIT - adsToday, 0);
    document.getElementById('tasks-completed-text').textContent = `${adsToday} / ${DAILY_TASK_LIMIT}`;
    document.getElementById('task-progress-bar').style.width = `${(adsToday / DAILY_TASK_LIMIT) * 100}%`;

    const watchBtn = document.getElementById('watch-ad-btn');
    if (watchBtn) {
      watchBtn.disabled = adsToday >= DAILY_TASK_LIMIT;
      watchBtn.textContent = adsToday >= DAILY_TASK_LIMIT ? 'All tasks done' : 'Watch Ad';
    }

    const referralInput = document.getElementById('referral-link');
    if (referralInput && telegramUserId) {
      referralInput.value = `https://t.me/${BOT_USERNAME}?start=${telegramUserId}`;
    }

    document.getElementById('refer-count').textContent = (user.total_referrals || 0);
    document.getElementById('popup-refer-earnings').textContent = refEarnings.toLocaleString();

    // Join bonus state
    const taskCard = document.getElementById('task-channel_1');
    if (taskCard) {
      const verifyBtn = taskCard.querySelector('.verify-btn');
      if (user.join_bonus) {
        taskCard.classList.add('completed');
        if (verifyBtn) verifyBtn.disabled = true;
        const doneEl = taskCard.querySelector('.task-done');
        if (doneEl) doneEl.style.display = 'block';
      } else {
        taskCard.classList.remove('completed');
        if (verifyBtn) verifyBtn.disabled = false;
        const doneEl = taskCard.querySelector('.task-done');
        if (doneEl) doneEl.style.display = 'none';
      }
    }
  }

  // --------- Realtime subscriptions ----------
  async function setupRealtime() {
    // cleanup previous channels if any
    try { if (usersChannel) sb.removeChannel(usersChannel); } catch (e) { /* ignore */ }
    try { if (withdrawalsChannel) sb.removeChannel(withdrawalsChannel); } catch (e) { /* ignore */ }

    if (!telegramUserId) return;

    // Use single-quote around the value in filter to match text equality
    const userFilter = `telegram_id=eq.'${telegramUserId}'`;
    const withdrawFilter = `user_id=eq.'${telegramUserId}'`;

    usersChannel = sb.channel('public:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: userFilter }, payload => {
        if (payload && payload.new) {
          updateUI(payload.new);
        }
      })
      .subscribe();

    withdrawalsChannel = sb.channel('public:withdrawals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals', filter: withdrawFilter }, payload => {
        // reload withdrawal history on any change
        loadWithdrawalHistory();
      })
      .subscribe();
  }

  // --------- Load withdrawal history ----------
  async function loadWithdrawalHistory() {
    try {
      const { data, error } = await sb.from('withdrawals').select('*').eq('user_id', telegramUserId).order('created_at', { ascending: false });
      const historyList = document.getElementById('history-list');
      if (!historyList) return;
      if (error) throw error;
      if (!data || data.length === 0) {
        historyList.innerHTML = '<p class="no-history">You have no withdrawal history yet.</p>';
        return;
      }
      historyList.innerHTML = data.map(w => {
        const dateStr = new Date(w.created_at).toLocaleDateString();
        return `<div class="history-item"><div class="history-amount">${Number(w.amount).toLocaleString()} PEPE</div><div class="history-date">${dateStr}</div><div class="history-status">${w.status}</div></div>`;
      }).join('');
    } catch (err) {
      console.error('loadWithdrawalHistory error', err);
    }
  }

  // --------- Event listeners (UI) ----------
  function wireUI() {
    // nav tabs
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        const tab = item.dataset.tab;
        const el = document.getElementById(tab);
        if (el) el.classList.add('active');
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      });
    });

    // referral modal
    const openRefer = document.getElementById('open-refer-modal-btn');
    const referModal = document.getElementById('refer-modal');
    const closeRefer = document.getElementById('close-refer-modal-btn');
    if (openRefer) openRefer.addEventListener('click', () => referModal.style.display = 'flex');
    if (closeRefer) closeRefer.addEventListener('click', () => referModal.style.display = 'none');
    window.addEventListener('click', (ev) => { if (ev.target === referModal) referModal.style.display = 'none'; });

    // copy referral
    const copyBtn = document.getElementById('copy-referral-btn');
    if (copyBtn) copyBtn.addEventListener('click', async () => {
      const referralInput = document.getElementById('referral-link');
      if (!referralInput) return;
      await navigator.clipboard.writeText(referralInput.value);
      copyBtn.textContent = 'Copied';
      setTimeout(() => copyBtn.textContent = 'Copy', 1400);
    });

    // watch ad
    const watchBtn = document.getElementById('watch-ad-btn');
    if (watchBtn) watchBtn.addEventListener('click', async (e) => {
      if (!currentUserState) return;
      if (watchBtn.disabled) return;
      watchBtn.disabled = true;
      try {
        const { data, error } = await sb.rpc('watch_ad', { user_id: telegramUserId });
        if (error) {
          alert(error.message || 'Error while watching ad');
        } else if (data) {
          // RPC returns the updated users row
          updateUI(data);
        }
      } catch (err) {
        console.error('watch_ad rpc error', err);
      } finally {
        setTimeout(() => { if (watchBtn) watchBtn.disabled = false; }, 1000);
      }
    });

    // bonus join/verify
    const taskCard = document.getElementById('task-channel_1');
    if (taskCard) {
      const joinBtn = taskCard.querySelector('.join-btn');
      const verifyBtn = taskCard.querySelector('.verify-btn');
      if (joinBtn) joinBtn.addEventListener('click', (e) => {
        const url = taskCard.dataset.url;
        if (tg && tg.openTelegramLink) tg.openTelegramLink(url);
        else window.open(url, '_blank');
        if (verifyBtn) verifyBtn.disabled = false;
      });
      if (verifyBtn) verifyBtn.addEventListener('click', async () => {
        if (!currentUserState) return;
        if (currentUserState.join_bonus) { alert('Already claimed'); return; }
        verifyBtn.disabled = true;
        try {
          const { data, error } = await sb.rpc('claim_bonus', { user_id: telegramUserId });
          if (error) {
            alert(error.message || 'Could not claim bonus');
          } else if (data) updateUI(data);
        } catch (err) {
          console.error('claim_bonus rpc error', err);
        }
      });
    }

    // withdraw
    const withdrawBtn = document.getElementById('withdraw-btn');
    if (withdrawBtn) withdrawBtn.addEventListener('click', async () => {
      const amount = parseInt(document.getElementById('withdraw-amount').value || '0', 10);
      const address = (document.getElementById('wallet-id').value || '').trim();
      if (!amount || amount < 10000) { alert('Enter a valid amount (min 10,000)'); return; }
      if (!address) { alert('Enter wallet id'); return; }
      if (!currentUserState || Number(currentUserState.balance) < amount) { alert('Insufficient balance'); return; }

      try {
        const { error } = await sb.rpc('request_withdrawal', { p_user_id: telegramUserId, p_amount: amount, p_address: address });
        if (error) alert(error.message || 'Withdrawal request failed');
        else {
          alert('Withdrawal requested');
          document.getElementById('withdraw-amount').value = '';
          document.getElementById('wallet-id').value = '';
          loadWithdrawalHistory();
        }
      } catch (err) {
        console.error('request_withdrawal rpc error', err);
      }
    });
  }

  // --------- Main init routine ----------
  async function initialize() {
    // parse Telegram init
    const { user: tgUser, startParam } = extractInitInfo(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe ? window.Telegram.WebApp.initDataUnsafe : {});

    telegramUserId = tgUser && tgUser.id ? String(tgUser.id) : `test_${String(Date.now())}`;

    // try to fetch existing user
    try {
      const { data: existing, error: selErr } = await sb.from('users').select('*').eq('telegram_id', telegramUserId).maybeSingle();
      if (selErr) {
        console.error('Error selecting user', selErr);
        // continue to attempt create via RPC
      }

      if (existing) {
        currentUserState = existing;
      } else {
        // create user atomically using the server RPC that also increments referral count
        try {
          const p_first_name = tgUser?.first_name || 'TelegramUser';
          const p_username = tgUser?.username || null;
          const p_referred_by = startParam || null;

          const { data: created, error: createErr } = await sb.rpc('create_user_with_referral', {
            p_telegram_id: telegramUserId,
            p_first_name,
            p_username,
            p_referred_by
          });

          if (createErr) {
            console.error('create_user_with_referral error', createErr);
            // as a fallback, create a plain user row (less ideal)
            const { data: fallback, error: fbErr } = await sb.from('users').insert({
              telegram_id: telegramUserId,
              first_name: p_first_name,
              username: p_username,
              referred_by: p_referred_by
            }).select().maybeSingle();
            if (fbErr) throw fbErr;
            currentUserState = fallback;
          } else {
            currentUserState = created;
          }
        } catch (err) {
          console.error('User creation error', err);
          return;
        }
      }

      // wire UI and start realtime
      updateUI(currentUserState);
      wireUI();
      await setupRealtime();
      await loadWithdrawalHistory();

    } catch (err) {
      console.error('Initialization error', err);
    }
  }

  // run the app
  initialize();
});
