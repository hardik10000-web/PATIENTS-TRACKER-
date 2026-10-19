(() => {
  const cfg = window.CLINIC_CONFIG || {};
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("YOUR-PROJECT-ID") &&
    !cfg.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
  const loginPanel = document.getElementById("login-panel");
  const dashboardPanel = document.getElementById("dashboard-panel");
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");
  const dashboardMessage = document.getElementById("dashboard-message");
  const rows = document.getElementById("patient-rows");
  const search = document.getElementById("search-input");
  let client = null;
  let registrations = [];
  let realtimeChannel = null;

  if (!configured || !window.supabase) {
    loginMessage.textContent = "Setup needed: add your Supabase project URL and anon key in config.js.";
    loginMessage.className = "notice warning";
    document.getElementById("login-button").disabled = true;
    return;
  }
  client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  document.getElementById("today-label").textContent = new Date().toLocaleDateString(undefined, { weekday:"long", year:"numeric", month:"long", day:"numeric" });

  function showNotice(el, text, type = "error") {
    el.textContent = text;
    el.className = `notice ${type}`;
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    }[ch]));
  }
  function timeLabel(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginMessage.className = "notice hidden";
    const button = document.getElementById("login-button");
    button.disabled = true;
    try {
      const { error } = await client.auth.signInWithPassword({
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value
      });
      if (error) throw error;
      await showDashboard();
    } catch (error) {
      showNotice(loginMessage, "Sign-in failed. Check your email and password, or contact the administrator.");
    } finally {
      button.disabled = false;
    }
  });

  async function showDashboard() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;
    loginPanel.classList.add("hidden");
    dashboardPanel.classList.remove("hidden");
    await loadRegistrations();
    if (realtimeChannel) await client.removeChannel(realtimeChannel);
    realtimeChannel = client.channel("clinic-patient-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "patients" }, () => loadRegistrations())
      .subscribe();
  }

  async function loadRegistrations() {
    rows.innerHTML = '<tr><td colspan="9" class="empty-cell">Loading registrations…</td></tr>';
    const { data, error } = await client.from("patients")
      .select("id, token_number, full_name, mobile, age_dob, gender, reason, reason_notes, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      showNotice(dashboardMessage, "Could not load registrations. Confirm that the dashboard account has access and the SQL setup is complete.");
      rows.innerHTML = '<tr><td colspan="9" class="empty-cell">Unable to load records.</td></tr>';
      return;
    }
    dashboardMessage.className = "notice hidden";
    registrations = data || [];
    renderRows();
  }

  function renderRows() {
    const today = todayISO();
    const todays = registrations.filter(p => {
  const d = new Date(p.created_at);
  const localDate =
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return localDate === today;
});
    document.getElementById("stat-total").textContent = todays.length;
    document.getElementById("stat-waiting").textContent = todays.filter(p => p.status === "Waiting").length;
    document.getElementById("stat-completed").textContent = todays.filter(p => p.status === "Completed").length;
    const q = search.value.trim().toLowerCase();
    const filtered = registrations.filter(p =>
      !q || p.full_name.toLowerCase().includes(q) || p.mobile.includes(q) || String(p.token_number).toLowerCase().includes(q)
    );
    if (!filtered.length) {
      rows.innerHTML = `<tr><td colspan="9" class="empty-cell">${q ? "No matching patients." : "No registrations yet."}</td></tr>`;
      return;
    }
    rows.innerHTML = filtered.map(p => `
      <tr>
        <td><span class="token-badge">${escapeHTML(p.token_number)}</span></td>
        <td><strong>${escapeHTML(p.full_name)}</strong>${p.reason_notes ? `<small class="row-note">${escapeHTML(p.reason_notes)}</small>` : ""}</td>
        <td>${escapeHTML(p.mobile)}</td>
        <td>${escapeHTML(p.age_dob)}</td>
        <td>${escapeHTML(p.gender)}</td>
        <td>${escapeHTML(p.reason)}</td>
        <td>${escapeHTML(new Date(p.created_at).toLocaleDateString())}<small class="row-note">${escapeHTML(timeLabel(p.created_at))}</small></td>
        <td><span class="status-pill ${p.status === "Completed" ? "done" : "waiting"}">${escapeHTML(p.status)}</span></td>
        <td><button class="table-action" data-id="${escapeHTML(p.id)}" data-next="${p.status === "Completed" ? "Waiting" : "Completed"}">${p.status === "Completed" ? "Reopen" : "Complete"}</button></td>
      </tr>`).join("");
  }

  rows.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-id]");
    if (!button) return;
    button.disabled = true;
    const { error } = await client.from("patients").update({ status: button.dataset.next }).eq("id", button.dataset.id);
    button.disabled = false;
    if (error) {
      showNotice(dashboardMessage, "Could not update patient status. Check database permissions.");
      return;
    }
    await loadRegistrations();
  });

  search.addEventListener("input", renderRows);
  document.getElementById("refresh-button").addEventListener("click", loadRegistrations);
  document.getElementById("logout-button").addEventListener("click", async () => {
    if (realtimeChannel) await client.removeChannel(realtimeChannel);
    await client.auth.signOut();
    dashboardPanel.classList.add("hidden");
    loginPanel.classList.remove("hidden");
    rows.innerHTML = '<tr><td colspan="9" class="empty-cell">Sign in to load registrations.</td></tr>';
  });

  client.auth.getSession().then(({ data }) => { if (data.session) showDashboard(); });
})();
