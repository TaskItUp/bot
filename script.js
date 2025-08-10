document.addEventListener('DOMContentLoaded', async () => {
  const SUPABASE_URL = 'https://edtghdbpocjrlgwstzoj.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkdGdoZGJwb2Nqcmxnd3N0em9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4MDEzMjQsImV4cCI6MjA3MDM3NzMyNH0.t3auZ04WivtssUq6w-G8GStE8nsXjV5AxvsSNGQPmac';
  const BOT_USERNAME = 'TaskItUpBot';
  const DAILY_TASK_LIMIT = 40;

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const tg = window.Telegram?.WebApp || null;
  if (tg?.expand) tg.expand();

  let telegramUserId = null;
  let currentUserState = null;

  function safeSetText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function extractInitInfo() {
    try {
      const init = tg?.initDataUnsafe || {};
      let user = init.user || null;
      let startParam = init.start_param || null;

      if (!user && init.initData) {
        const params = new URLSearchParams(init.initData);
        const u = params.get('user');
        if (u) user = JSON.parse(u);
        if (!startParam) startParam = params.get('start') || params.get('start_param');
      }
      return { user, startParam };
    } catch (err) {
      console.warn('extractInitInfo error', err);
      return { user: null, startParam: null };
    }
  }

  function updateUI(user) {
    if (!user) return;
    currentUserState = user;

    safeSetText('home-username', user.first_name || 'User');
    safeSetText('profile-name', user.first_name || 'User');
    safeSetText('telegram-username', user.username ? `@${user.username}` : '@username');

    safeSetText('balance-home', Math.floor(user.balance || 0).toLocaleString());
    safeSetText('profile-balance', Math.floor(user.balance || 0).toLocaleString());
    safeSetText('withdraw-balance', Math.floor(user.balance || 0).toLocaleString());

    safeSetText('earned-so-far', Math.floor(user.total_earned || 0).toLocaleString());
    safeSetText('total-ads-viewed', user.total_ads_viewed || 0);
    safeSetText('total-refers', user.total_referrals || 0);
    safeSetText('refer-earnings', Math.floor(user.referral_earnings || 0).toLocaleString());

    safeSetText('ads-watched-today', user.ads_watched || 0);
    safeSetText('ads-left-today', Math.max(DAILY_TASK_LIMIT - (user.ads_watched || 0), 0));
    safeSetText('tasks-completed-text', `${user.ads_watched || 0} / ${DAILY_TASK_LIMIT}`);

    const progress = document.getElementById('task-progress-bar');
    if (progress) progress.style.width = `${((user.ads_watched || 0) / DAILY_TASK_LIMIT) * 100}%`;

    const refInput = document.getElementById('referral-link');
    if (refInput) refInput.value = `https://t.me/${BOT_USERNAME}?start=${telegramUserId}`;

    safeSetText('refer-count', user.total_referrals || 0);
    safeSetText('popup-refer-earnings', Math.floor(user.referral_earnings || 0).toLocaleString());
  }

  async function loadWithdrawalHistory() {
    try {
      const { data, error } = await sb.from('withdrawals')
        .select('*')
        .eq('user_id', telegramUserId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const historyList = document.getElementById('history-list');
      if (!historyList) return;
      if (!data?.length) {
        historyList.innerHTML = '<p class="no-history">You have no withdrawal history yet.</p>';
      } else {
        historyList.innerHTML = data.map(w =>
          `<div>${w.amount} PEPE - ${w.status}</div>`
        ).join('');
      }
    } catch (err) {
      console.error('Withdrawal history error', err);
    }
  }

  function wireUI() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        const tab = item.dataset.tab;
        document.getElementById(tab)?.classList.add('active');
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      });
    });

    document.getElementById('open-refer-modal-btn')?.addEventListener('click', () => {
      document.getElementById('refer-modal').style.display = 'flex';
    });
    document.getElementById('close-refer-modal-btn')?.addEventListener('click', () => {
      document.getElementById('refer-modal').style.display = 'none';
    });
    document.getElementById('copy-referral-btn')?.addEventListener('click', () => {
      const refInput = document.getElementById('referral-link');
      if (refInput) navigator.clipboard.writeText(refInput.value);
    });

    document.getElementById('watch-ad-btn')?.addEventListener('click', async () => {
      try {
        const { data, error } = await sb.rpc('watch_ad', { user_id: telegramUserId });
        if (error) return alert(error.message);
        if (data) updateUI(data);
      } catch (err) {
        console.error('watch_ad error', err);
      }
    });

    document.querySelector('.verify-btn')?.addEventListener('click', async () => {
      try {
        const { data, error } = await sb.rpc('claim_bonus', { user_id: telegramUserId });
        if (error) return alert(error.message);
        if (data) updateUI(data);
      } catch (err) {
        console.error('claim_bonus error', err);
      }
    });

    document.getElementById('withdraw-btn')?.addEventListener('click', async () => {
      const amount = parseInt(document.getElementById('withdraw-amount')?.value || '0');
      const address = document.getElementById('wallet-id')?.value.trim();
      if (!amount || !address) return alert('Enter valid amount and wallet ID');
      try {
        const { error } = await sb.rpc('request_withdrawal', {
          p_user_id: telegramUserId,
          p_amount: amount,
          p_address: address
        });
        if (error) return alert(error.message);
        alert('Withdrawal requested');
        loadWithdrawalHistory();
      } catch (err) {
        console.error('withdraw error', err);
      }
    });
  }

  async function init() {
    try {
      const { user, startParam } = extractInitInfo();
      telegramUserId = user?.id ? String(user.id) : `test_${Date.now()}`;

      // get or create user
      const { data: existing } = await sb.from('users').select('*').eq('telegram_id', telegramUserId).maybeSingle();
      if (existing) {
        updateUI(existing);
      } else {
        const p_first_name = user?.first_name || 'TelegramUser';
        const p_username = user?.username || null;
        const p_referred_by = startParam || null;
        const { data: created, error } = await sb.rpc('create_user_with_referral', {
          p_telegram_id: telegramUserId,
          p_first_name,
          p_username,
          p_referred_by
        });
        if (error) throw error;
        updateUI(created);
      }

      wireUI();
      loadWithdrawalHistory();
    } catch (err) {
      console.error('Init error', err);
      alert('Error loading app. Check console.');
    }
  }

  init();
});
