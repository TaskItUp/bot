document.addEventListener('DOMContentLoaded', async () => {
  const SUPABASE_URL = 'https://edtghdbpocjrlgwstzoj.supabase.co';
  const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';
  const BOT_USERNAME = 'TaskItUpBot';
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const tg = window.Telegram?.WebApp || null;
  if (tg?.expand) tg.expand();

  let telegramUserId = null;
  let currentUser = null;

  function updateUI(user) {
    if (!user) return;
    currentUser = user;
    document.getElementById('home-username').textContent = user.first_name || 'User';
    document.getElementById('balance-home').textContent = user.balance || 0;
    document.getElementById('total-refers').textContent = user.total_referrals || 0;
    document.getElementById('profile-name').textContent = user.first_name || 'User';
    document.getElementById('telegram-username').textContent = user.username || 'username';
    document.getElementById('profile-balance').textContent = user.balance || 0;
    document.getElementById('profile-refers').textContent = user.total_referrals || 0;
    document.getElementById('referral-link').value = `https://t.me/${BOT_USERNAME}?start=${telegramUserId}`;
    document.getElementById('refer-count').textContent = user.total_referrals || 0;
    feather.replace();
  }

  async function initUser() {
    const initData = tg?.initDataUnsafe || {};
    const user = initData.user || { id: `test_${Date.now()}`, first_name: 'TestUser' };
    const startParam = initData.start_param || null;

    telegramUserId = String(user.id);
    const { data: existing } = await sb.from('users').select('*').eq('telegram_id', telegramUserId).maybeSingle();
    if (existing) {
      updateUI(existing);
    } else {
      const { data: created } = await sb.rpc('create_user_with_referral', {
        p_telegram_id: telegramUserId,
        p_first_name: user.first_name || '',
        p_username: user.username || '',
        p_referred_by: startParam
      });
      updateUI(created);
    }
  }

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
      document.getElementById(item.dataset.tab).classList.add('active');
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // Bonus
  document.getElementById('verify-bonus-btn').addEventListener('click', async () => {
    const { data } = await sb.rpc('claim_bonus', { user_id: telegramUserId });
    if (data) updateUI(data);
  });

  // Refer modal
  document.getElementById('open-refer-modal-btn').addEventListener('click', () => {
    document.getElementById('refer-modal').style.display = 'block';
  });
  document.getElementById('close-refer-modal-btn').addEventListener('click', () => {
    document.getElementById('refer-modal').style.display = 'none';
  });

  initUser();
});
