(() => {
  "use strict";

  const config = window.FUNDER_PURSUIT_CONFIG || {};
  const form = document.getElementById("research-form");
  const resultShell = document.getElementById("result");
  const progress = document.getElementById("research-progress");
  const progressTitle = document.getElementById("progress-title");
  const progressDetail = document.getElementById("progress-detail");
  const errorBox = document.getElementById("form-error");
  const saveProfile = document.getElementById("save-profile");
  const clearProfile = document.getElementById("clear-profile");
  const storageKey = "funder-pursuit-advisor-profile-v1";
  const profileFields = [
    "legalName", "organizationEin", "mission", "programAreas", "populations",
    "geographies", "annualBudget", "is501c3", "structure", "evidenceAvailable",
    "restrictions", "relationshipStatus", "knownPaths", "researchHours",
    "cultivationHours", "applicationHours", "loadedHourlyCost"
  ];
  const progressSteps = [
    ["Resolving the foundation", "Matching the legal entity, website, and public filing record."],
    ["Reading direct sources", "Checking current priorities, eligibility, geography, access, and grant-size guidance."],
    ["Comparing public behavior", "Looking for recent filings, observed grants, grantee announcements, and contradictions."],
    ["Applying the decision gates", "Testing identity, source coverage, eligibility, access, observed fit, and staff time."],
    ["Building the evidence record", "Linking each retained claim to a source and withholding unsupported claims."]
  ];
  let progressTimer;
  let lastReport = null;

  restoreProfile();
  form.addEventListener("submit", submitResearch);
  form.elements.relationshipStatus.addEventListener("change", updateRelationshipRequirement);
  form.elements.knownPaths.addEventListener("input", updateRelationshipRequirement);
  clearProfile.addEventListener("click", clearSavedProfile);
  resultShell.addEventListener("click", handleResultAction);
  updateRelationshipRequirement();

  async function submitResearch(event) {
    event.preventDefault();
    hideError();

    updateRelationshipRequirement();
    if (!form.reportValidity()) return;
    const payload = Object.fromEntries(new FormData(form).entries());
    if (Number(payload.askMin) > Number(payload.askMax)) {
      showError("Minimum request cannot exceed maximum request.");
      form.elements.askMin.focus();
      return;
    }
    if (!config.apiBaseUrl) {
      showError("The research service is not configured.");
      return;
    }

    if (saveProfile.checked) persistProfile();
    setBusy(true);

    try {
      const response = await fetch(`${config.apiBaseUrl.replace(/\/$/, "")}/pursuit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });
      const raw = await response.text();
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        throw new Error("The research service returned an unreadable response. Try again later.");
      }
      if (!response.ok) throw new Error(body.error || "The research request failed.");
      if (!body.result) throw new Error("The research service returned no decision record.");

      lastReport = {
        generatedAt: new Date().toISOString(),
        foundationName: payload.foundationName,
        nonprofitName: payload.legalName,
        result: body.result,
        research: body.research || null
      };
      renderResult(body.result, body.research || {}, payload.foundationName);
    } catch (error) {
      showError(error.message || "Research failed. Check the information and try again.");
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      setBusy(false);
    }
  }

  function setBusy(isBusy) {
    const button = form.querySelector("button[type='submit']");
    button.disabled = isBusy;
    button.textContent = isBusy ? "Researching public sources…" : "Research this foundation";
    form.setAttribute("aria-busy", String(isBusy));
    progress.hidden = !isBusy;
    if (isBusy) {
      resultShell.hidden = true;
      startProgress();
      progress.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      clearInterval(progressTimer);
    }
  }

  function startProgress() {
    let index = 0;
    showProgressStep(index);
    clearInterval(progressTimer);
    progressTimer = setInterval(() => {
      index = Math.min(index + 1, progressSteps.length - 1);
      showProgressStep(index);
    }, 18000);
  }

  function showProgressStep(index) {
    progressTitle.textContent = progressSteps[index][0];
    progressDetail.textContent = progressSteps[index][1];
  }

  function renderResult(result, research, foundationName) {
    if (result.state === "NEEDS HUMAN CHECK") {
      renderHumanCheck(result, research, foundationName);
      return;
    }

    const hours = result.hours_at_risk === null ? "Unknown" : `${formatNumber(result.hours_at_risk)} hours`;
    const cost = result.cost_at_risk === null ? "Not supplied" : formatMoney(result.cost_at_risk);
    const identity = result.identity || {};
    const filing = result.filing_summary || {};
    const kindora = result.kindora_research || {};
    resultShell.dataset.state = result.recommendation;
    resultShell.innerHTML = `
      <div class="result-hero">
        <div>
          <p class="result-kicker">Decision for ${escapeHtml(foundationName)}</p>
          <p class="decision-word">${escapeHtml(result.recommendation)}</p>
          <p class="decision-reason">${escapeHtml(result.decision_reason)}</p>
        </div>
        <dl class="result-meta">
          <div><dt>Hours at risk</dt><dd>${escapeHtml(hours)}</dd></div>
          <div><dt>Staff cost at risk</dt><dd>${escapeHtml(cost)}</dd></div>
          <div><dt>Confidence</dt><dd>${escapeHtml(capitalize(result.confidence))}</dd></div>
        </dl>
      </div>
      <div class="action-band">
        <div class="action-item"><span>What to do now</span><p>${escapeHtml(result.next_action)}</p></div>
        <div class="action-item"><span>When to reopen</span><p>${escapeHtml(result.reopen_condition || "No reopening condition is needed for this bounded next step.")}</p></div>
      </div>
      <section class="result-section">
        <div class="result-section-header"><h3>Identity and filing</h3><p>Research cutoff ${escapeHtml(formatDate(result.research_cutoff))}</p></div>
        <p class="identity-line"><span>Legal entity: <strong>${escapeHtml(identity.legal_name || "Unresolved")}</strong></span><span>EIN: <strong>${escapeHtml(identity.ein || "Not confirmed")}</strong></span><span>Identity: <strong>${escapeHtml(capitalize(identity.status || "unresolved"))}</strong></span></p>
        <div class="finding-grid" style="margin-top:18px">
          <article class="finding"><p class="finding-label">Identity basis</p><p>${escapeHtml(identity.explanation || "No identity explanation was returned.")}</p>${sourceLink(identity.source_url, "Open identity source")}</article>
          <article class="finding"><p class="finding-label">Filing coverage</p><h4>${escapeHtml(filingStatus(filing.status))}</h4><p>${escapeHtml(filing.explanation || "No filing summary was returned.")}</p>${filingYears(filing)}${sourceLink(filing.source_url, "Open filing record")}</article>
        </div>
      </section>
      <section class="result-section">
        <div class="result-section-header"><h3>Hard gates</h3><p>Explicit failures cannot be averaged away</p></div>
        ${renderGates(result.hard_gates || [])}
      </section>
      <section class="result-section">
        <div class="result-section-header"><h3>Access and observed behavior</h3><p>Stated policy and recent public evidence are separate</p></div>
        <div class="finding-grid">
          ${renderFinding("Application access", result.access)}
          ${renderFinding("Observed grant pattern", result.observed_pattern)}
        </div>
      </section>
      ${renderKindoraResearch(kindora)}
      <section class="result-section">
        <div class="result-section-header"><h3>What could change the decision</h3><p>Counterevidence and gaps stay visible</p></div>
        <div class="finding-grid">
          <article class="finding"><p class="finding-label">Strongest counterevidence</p>${renderCounterevidence(result.counterevidence || [])}</article>
          <article class="finding"><p class="finding-label">Missing evidence</p>${renderList(result.missing_evidence || [], "No material evidence gap was recorded.")}</article>
        </div>
      </section>
      <section class="result-section">
        <div class="result-section-header"><h3>Evidence ledger</h3><p>${escapeHtml(String((result.evidence_ledger || []).length))} retained source records</p></div>
        ${renderEvidence(result.evidence_ledger || [])}
      </section>
      ${renderWarnings(result.warnings || [])}
      <section class="result-section"><p class="human-note"><strong>Human review:</strong> ${escapeHtml(result.human_review)}</p></section>
      <div class="result-tools">
        <button class="tool-button" type="button" data-action="markdown">Download Markdown</button>
        <button class="tool-button" type="button" data-action="json">Download JSON</button>
        <button class="tool-button" type="button" data-action="new">Research another foundation</button>
      </div>`;
    showResult();
  }

  function renderHumanCheck(result, research, foundationName) {
    resultShell.dataset.state = "NEEDS HUMAN CHECK";
    resultShell.innerHTML = `
      <div class="result-hero">
        <div>
          <p class="result-kicker">Decision withheld for ${escapeHtml(foundationName)}</p>
          <p class="decision-word">HUMAN CHECK</p>
          <p class="decision-reason">${escapeHtml(result.explanation)}</p>
        </div>
        <dl class="result-meta">
          <div><dt>Reason</dt><dd>${escapeHtml(humanize(result.reason_code))}</dd></div>
          <div><dt>Sources retained</dt><dd>${escapeHtml(String(research.sourceCount || 0))}</dd></div>
        </dl>
      </div>
      <div class="action-band">
        <div class="action-item"><span>What to do now</span><p>Confirm the named identity, source, or input problem before committing staff time.</p></div>
        <div class="action-item"><span>What the tool did</span><p>Withheld a pursuit judgment instead of filling the evidence gap with an inference.</p></div>
      </div>
      <section class="result-section"><p class="human-note">No pursue, park, or decline status was created. This is a terminal review state, not a weak recommendation.</p></section>
      <div class="result-tools">
        <button class="tool-button" type="button" data-action="json">Download JSON</button>
        <button class="tool-button" type="button" data-action="new">Correct the information</button>
      </div>`;
    showResult();
  }

  function showResult() {
    progress.hidden = true;
    resultShell.hidden = false;
    resultShell.focus({ preventScroll: true });
    resultShell.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderGates(gates) {
    if (!gates.length) return '<p class="empty-note">No hard-gate findings were returned.</p>';
    return `<div class="gate-list">${gates.map((gate) => `
      <div class="gate">
        <span class="gate-name">${escapeHtml(humanize(gate.category))}</span>
        <span class="status-pill status-${escapeHtml(gate.status)}">${escapeHtml(gate.status)}</span>
        <p>${escapeHtml(gate.reason)}</p>
      </div>`).join("")}</div>`;
  }

  function renderFinding(label, finding = {}) {
    return `<article class="finding"><p class="finding-label">${escapeHtml(label)}</p><h4>${escapeHtml(humanize(finding.status || "unclear"))}</h4><p>${escapeHtml(finding.reason || "No finding was returned.")}</p></article>`;
  }

  function renderCounterevidence(items) {
    if (!items.length) return '<p class="empty-note">No material counterevidence was recorded.</p>';
    return `<ul class="plain-list">${items.map((item) => `<li>${escapeHtml(item.statement)}</li>`).join("")}</ul>`;
  }

  function renderList(items, emptyText) {
    if (!items.length) return `<p class="empty-note">${escapeHtml(emptyText)}</p>`;
    return `<ul class="plain-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function renderEvidence(items) {
    if (!items.length) return '<p class="empty-note">No evidence claim passed the source validation gate.</p>';
    return `<div class="evidence-list">${items.map((item) => `
      <article class="evidence-card">
        <div class="evidence-top">
          <h4>${escapeHtml(item.claim)}</h4>
          ${sourceLink(item.source_url, "Open source")}
        </div>
        <blockquote>${escapeHtml(item.support)}</blockquote>
        <div class="evidence-meta">
          <span>${escapeHtml(item.source_title)}</span>
          <span>${escapeHtml(humanize(item.source_owner))}</span>
          <span>${escapeHtml(humanize(item.evidence_type))}</span>
          <span>${escapeHtml(capitalize(item.confidence))} confidence</span>
          ${item.source_date ? `<span>Published ${escapeHtml(formatDate(item.source_date))}</span>` : ""}
          ${item.tax_period ? `<span>Tax period ${escapeHtml(item.tax_period)}</span>` : ""}
        </div>
      </article>`).join("")}</div>`;
  }

  function renderKindoraResearch(data) {
    const status = data.status || "unavailable";
    const match = data.matched_funder || {};
    const stats = data.giving_stats || {};
    const grants = Array.isArray(data.grants) ? data.grants : [];
    const programs = Array.isArray(data.open_programs) ? data.open_programs : [];
    const attributionUrl = safeUrl(data.attribution_url) || "https://www.kindora.co";
    const profileUrl = safeUrl(match.kindora_url) || attributionUrl;
    const statusLabel = {
      available: "Available",
      partial: "Partially available",
      ambiguous: "Identity unresolved",
      not_found: "No matching record",
      unavailable: "Temporarily unavailable",
      disabled: "Disabled"
    }[status] || humanize(status);
    const statCards = [
      ["Tracked grants", stats.total_grants === null || stats.total_grants === undefined ? "Unknown" : formatNumber(stats.total_grants)],
      ["Typical grant", stats.median_grant === null || stats.median_grant === undefined ? "Unknown" : formatMoney(stats.median_grant)],
      ["Years represented", Array.isArray(stats.years) && stats.years.length ? stats.years.join(", ") : "Unknown"]
    ];
    return `<section class="result-section">
      <div class="result-section-header"><h3>Structured grant evidence</h3><p><a href="${escapeHtml(attributionUrl)}" target="_blank" rel="noopener noreferrer">Data from Kindora ↗</a></p></div>
      <div class="structured-source-head">
        <div><p class="finding-label">Kindora status</p><h4>${escapeHtml(statusLabel)}</h4></div>
        ${match.legal_name ? `<p><strong>${escapeHtml(match.legal_name)}</strong>${match.ein ? ` · EIN ${escapeHtml(match.ein)}` : ""}<br><a class="evidence-link" href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener noreferrer">Open Kindora profile ↗</a></p>` : ""}
      </div>
      <div class="structured-stats">${statCards.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div>
      <h4 class="subsection-title">Recent itemized grants</h4>
      ${renderKindoraGrants(grants, profileUrl)}
      ${programs.length ? `<h4 class="subsection-title">Open programs matched to this EIN</h4>${renderKindoraPrograms(programs)}` : ""}
      <p class="source-caveat">Kindora records are provider-derived unless an underlying filing or foundation link is shown. They inform pattern analysis but cannot independently force a decline or prove a warm relationship.</p>
    </section>`;
  }

  function renderKindoraGrants(grants, profileUrl) {
    if (!grants.length) return '<p class="empty-note">No itemized Kindora grant records were available for this matched foundation.</p>';
    return `<div class="structured-grant-list">${grants.map((grant) => {
      const sourceUrl = safeUrl(grant.underlying_source_url) || profileUrl;
      const sourceLabel = grant.underlying_source_url ? "Open underlying source" : "Open Kindora record";
      return `<article class="structured-grant">
        <div><h5>${escapeHtml(grant.recipient_name || "Recipient not supplied")}</h5><p>${escapeHtml(grant.purpose || "Purpose not supplied")}</p></div>
        <div class="structured-grant-meta">
          <strong>${grant.amount === null || grant.amount === undefined ? "Amount not supplied" : escapeHtml(formatMoney(grant.amount))}</strong>
          <span>${grant.filing_year ? escapeHtml(String(grant.filing_year)) : "Year not supplied"}${grant.recipient_state ? ` · ${escapeHtml(grant.recipient_state)}` : ""}</span>
          <span>${escapeHtml(grant.source === "990" ? "IRS 990 grant line" : humanize(grant.source || "provider record"))}</span>
          <a class="evidence-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceLabel)} ↗</a>
        </div>
      </article>`;
    }).join("")}</div>`;
  }

  function renderKindoraPrograms(programs) {
    return `<div class="evidence-list">${programs.map((program) => `<article class="evidence-card">
      <div class="evidence-top"><h4>${escapeHtml(program.title || "Open program")}</h4>${sourceLink(program.application_url, "Open application source")}</div>
      <p>${escapeHtml(program.description || "No description supplied.")}</p>
      <div class="evidence-meta"><span>${escapeHtml(program.deadline || "Deadline not supplied")}</span><span>${escapeHtml(humanize(program.intake_type || "intake unclear"))}</span></div>
    </article>`).join("")}</div>`;
  }

  function renderWarnings(warnings) {
    if (!warnings.length) return "";
    return `<section class="result-section"><div class="result-section-header"><h3>Warnings</h3><p>Limits on this result</p></div>${renderList(warnings, "")}</section>`;
  }

  function filingYears(filing) {
    const years = Array.isArray(filing.filing_years) ? filing.filing_years : [];
    return years.length ? `<p><strong>Tax years:</strong> ${escapeHtml(years.join(", "))}</p>` : "";
  }

  function filingStatus(status) {
    const labels = { available: "Usable filing matched", limited: "Filing has limits", not_found: "No filing found", not_requested: "No filing matched" };
    return labels[status] || "Filing status unclear";
  }

  function sourceLink(value, label) {
    const url = safeUrl(value);
    return url ? `<p><a class="evidence-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a></p>` : "";
  }

  function handleResultAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button || !lastReport) return;
    const action = button.dataset.action;
    if (action === "json") downloadFile(reportFilename("json"), JSON.stringify(lastReport, null, 2), "application/json");
    if (action === "markdown") downloadFile(reportFilename("md"), reportAsMarkdown(lastReport), "text/markdown");
    if (action === "new") {
      resultShell.hidden = true;
      form.elements.foundationName.value = "";
      form.elements.foundationWebsite.value = "";
      form.elements.foundationEin.value = "";
      form.elements.foundationName.focus();
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function reportAsMarkdown(report) {
    const r = report.result;
    if (r.state === "NEEDS HUMAN CHECK") {
      return `# Funder Pursuit Advisor: Human Check\n\n**Foundation:** ${md(report.foundationName)}\n\n**Reason:** ${md(r.explanation)}\n\n**Reason code:** ${md(r.reason_code)}\n\nNo pursuit judgment was created.\n`;
    }
    const gates = (r.hard_gates || []).map((gate) => `- **${md(humanize(gate.category))}: ${md(gate.status.toUpperCase())}.** ${md(gate.reason)}`).join("\n");
    const evidence = (r.evidence_ledger || []).map((item, index) => `${index + 1}. **${md(item.claim)}** ${markdownLink(item.source_title, item.source_url)}\n   - ${md(item.support)}\n   - ${md(humanize(item.evidence_type))}; ${md(item.confidence)} confidence${item.tax_period ? `; tax period ${md(item.tax_period)}` : ""}`).join("\n");
    const kindora = kindoraAsMarkdown(r.kindora_research || {});
    return `# Funder Pursuit Advisor: ${md(r.recommendation)}\n\n**Foundation:** ${md(report.foundationName)}  \n**Nonprofit:** ${md(report.nonprofitName)}  \n**Research cutoff:** ${md(r.research_cutoff)}  \n**Confidence:** ${md(r.confidence)}\n\n## Decision\n\n${md(r.decision_reason)}\n\n**Next action:** ${md(r.next_action)}\n\n${r.reopen_condition ? `**Reopen when:** ${md(r.reopen_condition)}\n\n` : ""}**Hours at risk:** ${r.hours_at_risk ?? "Unknown"}  \n**Staff cost at risk:** ${r.cost_at_risk === null ? "Not supplied" : formatMoney(r.cost_at_risk)}\n\n## Hard gates\n\n${gates || "No hard-gate findings returned."}\n\n## Access\n\n**${md(humanize(r.access.status))}:** ${md(r.access.reason)}\n\n## Observed grant pattern\n\n**${md(humanize(r.observed_pattern.status))}:** ${md(r.observed_pattern.reason)}\n\n${kindora}\n\n## Missing evidence\n\n${(r.missing_evidence || []).map((item) => `- ${md(item)}`).join("\n") || "None recorded."}\n\n## Evidence ledger\n\n${evidence || "No evidence claim passed the source validation gate."}\n\n## Human review\n\n${md(r.human_review)}\n`;
  }

  function kindoraAsMarkdown(data) {
    const grants = (data.grants || []).map((grant) => {
      const amount = grant.amount === null || grant.amount === undefined ? "amount not supplied" : formatMoney(grant.amount);
      const link = safeUrl(grant.underlying_source_url) || safeUrl(data.matched_funder?.kindora_url) || "https://www.kindora.co";
      return `- **${md(grant.recipient_name || "Recipient not supplied")} · ${md(amount)}${grant.filing_year ? ` · ${md(grant.filing_year)}` : ""}.** ${md(grant.purpose || "Purpose not supplied")} ${markdownLink("Source", link)}`;
    }).join("\n");
    return `## Structured grant evidence\n\n**Status:** ${md(humanize(data.status || "unavailable"))}  \n**Source:** ${markdownLink("Data from Kindora", safeUrl(data.attribution_url) || "https://www.kindora.co")}\n\n${grants || "No itemized Kindora grant records were available."}\n\nKindora records are provider-derived unless an underlying source link is shown. They cannot independently force a decline or prove a warm relationship.`;
  }

  function reportFilename(extension) {
    const slug = String(lastReport.foundationName || "foundation").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    return `funder-pursuit-${slug || "report"}.${extension}`;
  }

  function downloadFile(filename, contents, type) {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function persistProfile() {
    try {
      const values = {};
      for (const name of profileFields) values[name] = form.elements[name]?.value || "";
      localStorage.setItem(storageKey, JSON.stringify(values));
    } catch {
      showError("This browser could not save the profile. The research request can still continue.");
    }
  }

  function restoreProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!saved || typeof saved !== "object") return;
      for (const name of profileFields) {
        if (form.elements[name] && typeof saved[name] === "string") form.elements[name].value = saved[name];
      }
      saveProfile.checked = true;
    } catch {
      localStorage.removeItem(storageKey);
    }
  }

  function clearSavedProfile() {
    try { localStorage.removeItem(storageKey); } catch { /* Storage may be unavailable. */ }
    saveProfile.checked = false;
    for (const name of profileFields) {
      if (!form.elements[name]) continue;
      form.elements[name].value = name === "researchHours" ? "4" : name === "cultivationHours" ? "12" : name === "applicationHours" ? "30" : name === "structure" ? "standalone" : name === "relationshipStatus" ? "none" : "";
    }
    updateRelationshipRequirement();
    clearProfile.textContent = "Saved profile cleared";
    setTimeout(() => { clearProfile.textContent = "Clear saved profile"; }, 1800);
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function hideError() {
    errorBox.textContent = "";
    errorBox.hidden = true;
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
    } catch { return null; }
  }

  function markdownLink(label, value) {
    const url = safeUrl(value);
    if (!url) return md(label);
    const destination = url.replace(/[()<>\\\s]/g, (character) => encodeURIComponent(character));
    return `[${md(label)}](<${destination}>)`;
  }

  function updateRelationshipRequirement() {
    const relationshipStatus = form.elements.relationshipStatus.value;
    const knownPaths = form.elements.knownPaths;
    const requiresPath = ["warm_path", "current_funder"].includes(relationshipStatus);
    knownPaths.required = requiresPath;
    knownPaths.setCustomValidity(requiresPath && knownPaths.value.trim().length < 10
      ? "Name the confirmed relationship route and why your team considers it real."
      : "");
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? String(value || "Unknown") : new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(date);
  }

  function humanize(value) {
    return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function capitalize(value) {
    const text = String(value || "");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function md(value) {
    return String(value ?? "").replace(/([\\`*_[\]<>])/g, "\\$1").replace(/\|/g, "\\|");
  }
})();
