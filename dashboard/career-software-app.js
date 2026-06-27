(() => {
  const seed = window.careerOSSeed || { jobs: [], learningGoals: [], collector: { learnedRules: [] } };
  const native = window.careerOSNative || null;
  const storageKey = 'careerOSPublicDemoState';

  let state = {
    jobs: seed.jobs,
    learningGoals: seed.learningGoals,
    collector: seed.collector,
    requests: [],
  };

  const pages = [
    { id: 'home', label: 'Overview' },
    { id: 'jobs', label: 'Job Tracker' },
    { id: 'collector', label: 'Collector Lab' },
    { id: 'personal', label: 'Personal Data Boundary' },
  ];

  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  async function loadState() {
    try {
      const persisted = native ? await native.readState() : JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (persisted && Array.isArray(persisted.jobs)) state = { ...state, ...persisted };
    } catch {
      state = { ...state };
    }
  }

  async function saveState() {
    if (native) {
      await native.writeState(state);
    } else {
      localStorage.setItem(storageKey, JSON.stringify(state));
    }
  }

  function route() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [page = 'home', id = ''] = raw.split('/');
    return { page: pages.some((item) => item.id === page) ? page : 'home', id };
  }

  function setRoute(page, id = '') {
    location.hash = id ? `#/${page}/${id}` : `#/${page}`;
  }

  function age(deadline) {
    const days = Math.ceil((new Date(deadline) - new Date()) / 86400000);
    if (Number.isNaN(days)) return 'No deadline';
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    return `${days} days left`;
  }

  function statusLabel(status) {
    return {
      collected: 'Collected',
      approved: 'Approved',
      processing: 'Processing',
      submitted: 'Submitted',
      rejected: 'Rejected',
    }[status] || status;
  }

  function renderNav(active) {
    $('nav').innerHTML = pages.map((page) => `
      <button class="nav-item ${page.id === active ? 'active' : ''}" data-page="${page.id}" type="button">
        ${escapeHtml(page.label)}
      </button>
    `).join('');

    document.querySelectorAll('.nav-item').forEach((button) => {
      button.addEventListener('click', () => setRoute(button.dataset.page));
    });
  }

  function render() {
    const { page, id } = route();
    renderNav(page);
    const renderers = { home: renderHome, jobs: renderJobs, collector: renderCollector, personal: renderPersonal };
    renderers[page](id);
  }

  function setHeader(eyebrow, title) {
    $('eyebrow').textContent = eyebrow;
    $('title').textContent = title;
  }

  function stats() {
    return {
      collected: state.jobs.filter((job) => job.status === 'collected').length,
      approved: state.jobs.filter((job) => job.status === 'approved').length,
      processing: state.jobs.filter((job) => job.status === 'processing').length,
      submitted: state.jobs.filter((job) => job.status === 'submitted').length,
    };
  }

  function renderHome() {
    setHeader('Local-first career workflow', 'Career OS AI Copilot');
    const counts = stats();
    $('app').innerHTML = `
      <section class="hero card">
        <div>
          <p class="pill">Personal-use prototype</p>
          <h2>AI-led implementation, human-led judgment.</h2>
          <p>This public demo shows the workflow architecture for tracking jobs, approving opportunities, and organizing package work. Real job data and application materials are intentionally excluded.</p>
        </div>
        <div class="hero-actions">
          <button data-open="jobs" type="button">Open job tracker</button>
          <button data-open="collector" type="button">Open collector lab</button>
        </div>
      </section>
      <section class="grid four">
        ${metric('Collected', counts.collected)}
        ${metric('Approved', counts.approved)}
        ${metric('Processing', counts.processing)}
        ${metric('Submitted', counts.submitted)}
      </section>
      <section class="grid two">
        <article class="card">
          <h3>Learning Goals</h3>
          ${state.learningGoals.map((goal) => `
            <div class="goal"><span>${escapeHtml(goal.name)}</span><b>${goal.progress}%</b><i style="width:${goal.progress}%"></i></div>
          `).join('')}
        </article>
        <article class="card">
          <h3>Build Provenance</h3>
          <p>The human operator supplied the product direction, workflow constraints, preference judgment, and review loop. The AI coding agent carried much of the implementation, debugging, documentation, and packaging.</p>
        </article>
      </section>
    `;
    document.querySelectorAll('[data-open]').forEach((button) => button.addEventListener('click', () => setRoute(button.dataset.open)));
  }

  function metric(label, value) {
    return `<article class="metric card"><span>${escapeHtml(label)}</span><strong>${value}</strong></article>`;
  }

  function renderJobs(id) {
    if (id) return renderJobDetail(id);
    setHeader('Order-style application tracking', 'Job Tracker');
    const rows = [...state.jobs].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    $('app').innerHTML = `
      <article class="card">
        <div class="section-head"><h2>Tracked Jobs</h2><p>Every job stays in one pool and moves through collected, approved, processing, and submitted states.</p></div>
        <div class="table">
          <div class="table-head"><span>Job</span><span>Term</span><span>Source</span><span>Deadline</span><span>Status</span><span>Fit</span></div>
          ${rows.map(jobRow).join('')}
        </div>
      </article>
    `;
    document.querySelectorAll('[data-job]').forEach((row) => row.addEventListener('click', () => setRoute('jobs', row.dataset.job)));
  }

  function jobRow(job) {
    return `
      <button class="job-row" data-job="${escapeHtml(job.id)}" type="button">
        <span><strong>${escapeHtml(job.role)}</strong><small>${escapeHtml(job.company)} · ${escapeHtml(job.id)}</small></span>
        <span>${escapeHtml(job.term)}</span>
        <span>${escapeHtml(job.source)}</span>
        <span>${escapeHtml(age(job.deadline))}</span>
        <span class="status ${escapeHtml(job.status)}">${escapeHtml(statusLabel(job.status))}</span>
        <span>${job.fit}/100</span>
      </button>
    `;
  }

  function renderJobDetail(id) {
    const job = state.jobs.find((item) => item.id === id);
    if (!job) return setRoute('jobs');
    setHeader(job.id, job.role);
    $('app').innerHTML = `
      <button class="back" type="button" id="back-to-jobs">← Back to tracker</button>
      <article class="card detail">
        <div>
          <p class="pill">${escapeHtml(job.source)} · ${escapeHtml(job.term)}</p>
          <h2>${escapeHtml(job.company)}</h2>
          <p>${escapeHtml(job.notes)}</p>
          <a href="${escapeHtml(job.link)}" target="_blank" rel="noreferrer">Open source link</a>
        </div>
        <aside>
          <strong>${job.fit}/100</strong>
          <span class="status ${escapeHtml(job.status)}">${escapeHtml(statusLabel(job.status))}</span>
          <small>${escapeHtml(age(job.deadline))}</small>
        </aside>
      </article>
      <section class="card">
        <h3>Workflow Actions</h3>
        <div class="actions">
          <button data-status="approved" type="button">Approve</button>
          <button data-status="processing" type="button">Start package work</button>
          <button data-status="submitted" type="button">Mark submitted</button>
          <button data-folder type="button">Create local folder</button>
        </div>
      </section>
    `;
    $('back-to-jobs').addEventListener('click', () => setRoute('jobs'));
    document.querySelectorAll('[data-status]').forEach((button) => {
      button.addEventListener('click', async () => {
        job.status = button.dataset.status;
        await saveState();
        renderJobDetail(id);
      });
    });
    document.querySelector('[data-folder]').addEventListener('click', async () => {
      if (native) await native.ensureJobFolder(job);
      alert('Folder request recorded for local Electron mode.');
    });
  }

  function renderCollector() {
    setHeader('Experimental automation module', 'Collector Lab');
    $('app').innerHTML = `
      <section class="card">
        <h2>Preference Rules</h2>
        <p>The collector is designed to collect opportunities, score them, and ask for human approval before package work begins.</p>
        <ul class="rules">${state.collector.learnedRules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join('')}</ul>
      </section>
      <section class="card">
        <h2>Request Queue</h2>
        <p>This demo records a local request instead of scraping logged-in job boards.</p>
        <button id="request-collector" type="button">Request collector refresh</button>
        <pre>${escapeHtml(JSON.stringify(state.requests, null, 2))}</pre>
      </section>
    `;
    $('request-collector').addEventListener('click', async () => {
      state.requests.push({ type: 'collector_refresh', createdAt: new Date().toISOString(), status: 'requested' });
      await saveState();
      renderCollector();
    });
  }

  function renderPersonal() {
    setHeader('Privacy boundary', 'Personal Data Boundary');
    $('app').innerHTML = `
      <section class="grid two">
        <article class="card">
          <h2>Public repo includes</h2>
          <ul><li>Demo jobs</li><li>Architecture notes</li><li>Workflow code</li><li>AI collaboration disclosure</li></ul>
        </article>
        <article class="card danger">
          <h2>Public repo excludes</h2>
          <ul><li>Real resumes</li><li>Real job links</li><li>School portal data</li><li>Runtime JSON state</li></ul>
        </article>
      </section>
    `;
  }

  $('reset-demo').addEventListener('click', async () => {
    state = { jobs: seed.jobs, learningGoals: seed.learningGoals, collector: seed.collector, requests: [] };
    if (!native) localStorage.removeItem(storageKey);
    await saveState();
    render();
  });

  window.addEventListener('hashchange', render);
  loadState().then(render);
})();
