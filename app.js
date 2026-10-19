(() => {
  const cfg = window.CLINIC_CONFIG || {};
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("YOUR-PROJECT-ID") &&
    !cfg.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
  const warning = document.getElementById("config-warning");
  const form = document.getElementById("patient-form");
  const submitButton = document.getElementById("submit-button");
  const message = document.getElementById("form-message");
  const receipt = document.getElementById("receipt");
  let supabaseClient = null;
  let lastReceipt = null;

  if (!configured || !window.supabase) {
    warning.classList.remove("hidden");
    submitButton.disabled = true;
    return;
  }
  supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `notice ${type}`;
  }
  function clean(value) { return String(value || "").trim(); }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.className = "notice hidden";
    if (!form.reportValidity()) return;

    const full_name = clean(form.full_name.value);
    const mobile = clean(form.mobile.value).replace(/[()\s-]/g, "");
    const age_dob = clean(form.age_dob.value);
    const gender = clean(form.gender.value);
    const reason = clean(form.reason.value);
    const reason_notes = clean(form.reason_notes.value);

    if (full_name.length < 2) return showMessage("Please enter the patient's full name.");
    if (!/^\+?[0-9]{8,15}$/.test(mobile)) return showMessage("Enter a valid mobile number, including country code if needed.");
    if (age_dob.length < 1 || age_dob.length > 30) return showMessage("Enter an age or date of birth.");

    submitButton.disabled = true;
    submitButton.innerHTML = '<span>Registering securely…</span>';
    try {
      const { data, error } = await supabaseClient.rpc("register_patient", {
        p_full_name: full_name,
        p_mobile: mobile,
        p_age_dob: age_dob,
        p_gender: gender,
        p_reason: reason,
        p_reason_notes: reason_notes || null
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result || !result.token_number) throw new Error("Registration did not return a token. Please contact reception.");
      lastReceipt = { token: result.token_number, name: full_name, createdAt: new Date() };
      document.getElementById("receipt-token").textContent = result.token_number;
      document.getElementById("receipt-name").textContent = full_name;
      document.getElementById("receipt-date").textContent = `Registered ${lastReceipt.createdAt.toLocaleString()}`;
      form.classList.add("hidden");
      document.querySelector(".card-heading").classList.add("hidden");
      receipt.classList.remove("hidden");
      receipt.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      console.error("Registration error:", error);
      showMessage("We couldn't complete the registration. Please check your connection or contact reception.");
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = '<span>Register patient</span><span aria-hidden="true">→</span>';
    }
  });

  document.getElementById("print-receipt").addEventListener("click", () => window.print());
  document.getElementById("register-another").addEventListener("click", () => {
    form.reset();
    form.classList.remove("hidden");
    document.querySelector(".card-heading").classList.remove("hidden");
    receipt.classList.add("hidden");
    message.className = "notice hidden";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();
