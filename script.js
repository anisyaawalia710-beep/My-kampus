/**
 * MY KAMPUS — Vanilla JavaScript
 * ================================
 * Sections:
 *  1. Storage Helpers       — load/save data from LocalStorage
 *  2. Navigation            — sidebar & page switching
 *  3. Dashboard             — stats, today's schedule, upcoming deadlines
 *  4. Jadwal (Schedule)     — CRUD + filter by day
 *  5. Tugas (Tasks)         — CRUD + filter by status
 *  6. Kalender (Calendar)   — monthly view + academic events CRUD
 *  7. Asisten (Assistant)   — chat-based info lookup
 *  8. Profil (Profile)      — edit & display student profile
 *  9. Utilities             — toast, modal helpers, date helpers
 * 10. Init                  — bootstrap on DOM ready
 */

'use strict';

/* ==============================================
   1. STORAGE HELPERS
   ============================================== */

/** Keys used in LocalStorage */
const KEYS = {
  schedules : 'mk_schedules',
  tasks     : 'mk_tasks',
  events    : 'mk_events',
  profile   : 'mk_profile',
};

/** Load an array from LocalStorage, return [] if not found */
function loadList(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

/** Save an array to LocalStorage */
function saveList(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

/** Load an object from LocalStorage */
function loadObj(key, fallback = {}) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

/** Generate a simple unique ID */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ==============================================
   2. NAVIGATION
   ============================================== */

let currentPage = 'dashboard';

/** Toggle sidebar visibility on mobile */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('hidden');
}

/** Switch to a named page section */
function navigateTo(page) {
  // Hide all sections
  document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'));
  // Show target
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.remove('hidden');

  // Update nav active state
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  currentPage = page;

  // Refresh page data when switching
  if (page === 'dashboard') renderDashboard();
  if (page === 'jadwal')    renderSchedules();
  if (page === 'tugas')     renderTasks();
  if (page === 'kalender')  renderCalendar();
  if (page === 'profil')    renderProfile();

  // Close sidebar on mobile after navigation
  const sidebar = document.getElementById('sidebar');
  if (sidebar.classList.contains('open')) toggleSidebar();
}

/** Attach click listeners to nav buttons */
function initNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });
}

/* ==============================================
   3. DASHBOARD
   ============================================== */

/** Indonesian day names */
const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
/** Indonesian month names */
const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

/** Render all dashboard content */
function renderDashboard() {
  const now        = new Date();
  const todayName  = DAYS_ID[now.getDay()];
  const schedules  = loadList(KEYS.schedules);
  const tasks      = loadList(KEYS.tasks);
  const profile    = loadObj(KEYS.profile, { name: 'Mahasiswa' });

  // Welcome & date
  setText('dashWelcomeName', profile.name || 'Mahasiswa');
  setText('dashDateFull', `${todayName}, ${now.getDate()} ${MONTHS_ID[now.getMonth()]} ${now.getFullYear()}`);
  setText('dashTodayDay', todayName);
  setText('headerDate', `${now.getDate()} ${MONTHS_ID[now.getMonth()]} ${now.getFullYear()}`);

  // Stats
  const uniqueMatkul  = [...new Set(schedules.map(s => s.matkul))].length;
  const todayClasses  = schedules.filter(s => s.hari === todayName);
  const pendingTasks  = tasks.filter(t => t.status !== 'selesai');
  const nearDeadline  = tasks.filter(t => t.status !== 'selesai' && daysUntil(t.deadline) <= 7 && daysUntil(t.deadline) >= 0);

  setText('statMatkul',   uniqueMatkul);
  setText('statHariIni',  todayClasses.length);
  setText('statTugas',    tasks.length);
  setText('statDeadline', nearDeadline.length);

  // Today's schedule sorted by start time
  const todaySorted = [...todayClasses].sort((a, b) => a.mulai.localeCompare(b.mulai));
  const todayEl = document.getElementById('dashTodaySchedule');
  if (todaySorted.length === 0) {
    todayEl.innerHTML = `<p class="text-sm text-gray-400 text-center py-4">Tidak ada kelas hari ini 🎉</p>`;
  } else {
    todayEl.innerHTML = todaySorted.map(s => `
      <div class="today-item">
        <div class="time-badge">${s.mulai}–${s.selesai}</div>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-gray-700 truncate">${esc(s.matkul)}</p>
          <p class="text-xs text-gray-400 truncate">${esc(s.ruang)} · ${esc(s.dosen)}</p>
        </div>
      </div>
    `).join('');
  }

  // Upcoming deadlines (next 7 days, not selesai, sorted)
  const deadlineEl = document.getElementById('dashDeadlines');
  const upcoming = [...nearDeadline].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  if (upcoming.length === 0) {
    deadlineEl.innerHTML = `<p class="text-sm text-gray-400 text-center py-4">Tidak ada deadline dalam 7 hari ke depan ✅</p>`;
  } else {
    deadlineEl.innerHTML = upcoming.map(t => {
      const d = daysUntil(t.deadline);
      const urgency = d <= 1 ? 'text-red-500' : d <= 3 ? 'text-orange-500' : 'text-yellow-600';
      return `
        <div class="today-item justify-between">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-gray-700 truncate">${esc(t.name)}</p>
            <p class="text-xs text-gray-400 truncate">${esc(t.matkul)}</p>
          </div>
          <div class="ml-2 text-right flex-shrink-0">
            <p class="text-xs font-bold ${urgency}">${d === 0 ? 'Hari ini!' : d === 1 ? 'Besok!' : `${d} hari`}</p>
            <p class="text-xs text-gray-400">${formatDate(t.deadline)}</p>
          </div>
        </div>
      `;
    }).join('');
  }
}

/* ==============================================
   4. JADWAL KULIAH (SCHEDULE)
   ============================================== */

let activeDay = 'all'; // current day filter

/** Render schedule cards with optional day filter */
function renderSchedules(filterDay = activeDay) {
  activeDay = filterDay;
  const schedules = loadList(KEYS.schedules);
  const container = document.getElementById('scheduleList');

  // Filter
  const filtered = filterDay === 'all'
    ? schedules
    : schedules.filter(s => s.hari === filterDay);

  // Sort by day order then time
  const dayOrder = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const sorted = [...filtered].sort((a, b) => {
    const di = dayOrder.indexOf(a.hari) - dayOrder.indexOf(b.hari);
    return di !== 0 ? di : a.mulai.localeCompare(b.mulai);
  });

  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12 text-gray-400">
        <svg class="w-12 h-12 mx-auto mb-3 text-pink-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <p class="text-sm">${filterDay === 'all' ? 'Belum ada jadwal. Tambahkan jadwal kuliah Anda!' : `Tidak ada jadwal hari ${filterDay}.`}</p>
      </div>`;
    return;
  }

  container.innerHTML = sorted.map(s => `
    <div class="schedule-card pl-6">
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="min-w-0">
          <h4 class="font-semibold text-gray-800 text-sm truncate">${esc(s.matkul)}</h4>
          <p class="text-xs text-gray-500 mt-0.5 truncate">${esc(s.dosen)}</p>
        </div>
        <span class="text-xs font-medium bg-pink-50 text-pink-500 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">${esc(s.hari)}</span>
      </div>
      <div class="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
        <span class="flex items-center gap-1">
          <svg class="w-3.5 h-3.5 text-pink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          ${s.mulai} – ${s.selesai}
        </span>
        <span class="flex items-center gap-1">
          <svg class="w-3.5 h-3.5 text-pink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          ${esc(s.ruang)}
        </span>
      </div>
      <div class="flex gap-2 mt-3">
        <button onclick="editSchedule('${s.id}')" class="btn-secondary text-xs px-3 py-1.5 flex-1">Edit</button>
        <button onclick="deleteSchedule('${s.id}')" class="btn-danger flex-1">Hapus</button>
      </div>
    </div>
  `).join('');
}

/** Open empty modal for adding new schedule */
function openScheduleModal() {
  document.getElementById('scheduleId').value = '';
  document.getElementById('scheduleForm').reset();
  setText('scheduleModalTitle', 'Tambah Jadwal');
  showModal('scheduleModal');
}

/** Open modal prefilled for editing a schedule */
function editSchedule(id) {
  const schedules = loadList(KEYS.schedules);
  const item = schedules.find(s => s.id === id);
  if (!item) return;

  document.getElementById('scheduleId').value    = item.id;
  document.getElementById('schedMatkul').value   = item.matkul;
  document.getElementById('schedDosen').value    = item.dosen;
  document.getElementById('schedHari').value     = item.hari;
  document.getElementById('schedMulai').value    = item.mulai;
  document.getElementById('schedSelesai').value  = item.selesai;
  document.getElementById('schedRuang').value    = item.ruang;
  setText('scheduleModalTitle', 'Edit Jadwal');
  showModal('scheduleModal');
}

/** Save (add or update) schedule from form */
function saveSchedule(e) {
  e.preventDefault();
  const id      = document.getElementById('scheduleId').value;
  const matkul  = document.getElementById('schedMatkul').value.trim();
  const dosen   = document.getElementById('schedDosen').value.trim();
  const hari    = document.getElementById('schedHari').value;
  const mulai   = document.getElementById('schedMulai').value;
  const selesai = document.getElementById('schedSelesai').value;
  const ruang   = document.getElementById('schedRuang').value.trim();

  const schedules = loadList(KEYS.schedules);

  if (id) {
    // Update existing
    const idx = schedules.findIndex(s => s.id === id);
    if (idx !== -1) schedules[idx] = { id, matkul, dosen, hari, mulai, selesai, ruang };
    showToast('Jadwal berhasil diperbarui ✅');
  } else {
    // Add new
    schedules.push({ id: genId(), matkul, dosen, hari, mulai, selesai, ruang });
    showToast('Jadwal berhasil ditambahkan 🎉');
  }

  saveList(KEYS.schedules, schedules);
  closeScheduleModal();
  renderSchedules();
  if (currentPage === 'dashboard') renderDashboard();
}

/** Delete a schedule by ID */
function deleteSchedule(id) {
  if (!confirm('Hapus jadwal ini?')) return;
  const schedules = loadList(KEYS.schedules).filter(s => s.id !== id);
  saveList(KEYS.schedules, schedules);
  renderSchedules();
  showToast('Jadwal dihapus.');
  if (currentPage === 'dashboard') renderDashboard();
}

function closeScheduleModal() { hideModal('scheduleModal'); }

/** Initialize day filter buttons */
function initDayFilter() {
  document.querySelectorAll('#dayFilterBtns .day-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#dayFilterBtns .day-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderSchedules(btn.dataset.day);
    });
  });
}

/* ==============================================
   5. TUGAS (TASKS)
   ============================================== */

let activeTaskFilter = 'all';

/** Render task list with optional status filter */
function renderTasks(filter = activeTaskFilter) {
  activeTaskFilter = filter;
  const tasks     = loadList(KEYS.tasks);
  const container = document.getElementById('taskList');

  const filtered = filter === 'all' ? tasks
    : tasks.filter(t => t.status === filter);

  // Sort: pending first, then by deadline ascending
  const sorted = [...filtered].sort((a, b) => {
    if (a.status === b.status) return new Date(a.deadline) - new Date(b.deadline);
    return a.status === 'selesai' ? 1 : -1;
  });

  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 text-gray-400">
        <svg class="w-12 h-12 mx-auto mb-3 text-pink-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
        <p class="text-sm">${filter === 'all' ? 'Belum ada tugas. Tambahkan tugas Anda!' : 'Tidak ada tugas dengan status ini.'}</p>
      </div>`;
    return;
  }

  container.innerHTML = sorted.map(t => {
    const d         = daysUntil(t.deadline);
    const isWarning = t.status !== 'selesai' && d >= 0 && d <= 3;
    const isDone    = t.status === 'selesai';

    return `
      <div class="task-card ${isDone ? 'done' : ''} ${isWarning ? 'deadline-warning' : ''}">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-3 flex-1 min-w-0">
            <!-- Checkbox toggle -->
            <button onclick="toggleTaskStatus('${t.id}')" class="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 ${isDone ? 'bg-pink-400 border-pink-400' : 'border-pink-300'} flex items-center justify-center transition-colors">
              ${isDone ? `<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>` : ''}
            </button>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-sm text-gray-800 ${isDone ? 'line-through text-gray-400' : ''}">${esc(t.name)}</p>
              <p class="text-xs text-pink-400 mt-0.5">${esc(t.matkul)}</p>
              ${t.desc ? `<p class="text-xs text-gray-500 mt-1 line-clamp-2">${esc(t.desc)}</p>` : ''}
            </div>
          </div>
          <div class="flex-shrink-0 text-right">
            <span class="inline-block text-xs px-2 py-0.5 rounded-full mb-2 ${isDone ? 'bg-green-50 text-green-600' : 'bg-pink-50 text-pink-500'}">
              ${isDone ? '✅ Selesai' : '📌 Belum'}
            </span>
            <p class="text-xs text-gray-400">${formatDate(t.deadline)}</p>
            ${!isDone && d >= 0 ? `<p class="text-xs font-bold ${d <= 1 ? 'text-red-500' : d <= 3 ? 'text-orange-500' : 'text-gray-400'}">${d === 0 ? 'Hari ini!' : d === 1 ? 'Besok' : `${d} hari lagi`}</p>` : ''}
            ${!isDone && d < 0 ? `<p class="text-xs font-bold text-red-600">Terlambat!</p>` : ''}
          </div>
        </div>
        <div class="flex gap-2 mt-3 pt-3 border-t border-pink-50">
          <button onclick="editTask('${t.id}')" class="btn-secondary text-xs px-3 py-1.5 flex-1">Edit</button>
          <button onclick="deleteTask('${t.id}')" class="btn-danger flex-1">Hapus</button>
        </div>
      </div>
    `;
  }).join('');
}

/** Toggle task status between belum/selesai */
function toggleTaskStatus(id) {
  const tasks = loadList(KEYS.tasks);
  const idx   = tasks.findIndex(t => t.id === id);
  if (idx !== -1) {
    tasks[idx].status = tasks[idx].status === 'selesai' ? 'belum' : 'selesai';
    saveList(KEYS.tasks, tasks);
    renderTasks();
    showToast(tasks[idx].status === 'selesai' ? 'Tugas ditandai selesai ✅' : 'Tugas dikembalikan ke belum dikerjakan.');
  }
}

/** Filter tasks by status (called from filter buttons) */
function filterTasks(btn) {
  document.querySelectorAll('[data-status]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTasks(btn.dataset.status);
}

/** Open task modal for new entry */
function openTaskModal() {
  document.getElementById('taskId').value = '';
  document.getElementById('taskForm').reset();
  setText('taskModalTitle', 'Tambah Tugas');
  showModal('taskModal');
}

/** Open task modal prefilled for edit */
function editTask(id) {
  const tasks = loadList(KEYS.tasks);
  const item  = tasks.find(t => t.id === id);
  if (!item) return;

  document.getElementById('taskId').value       = item.id;
  document.getElementById('taskName').value     = item.name;
  document.getElementById('taskMatkul').value   = item.matkul;
  document.getElementById('taskDesc').value     = item.desc || '';
  document.getElementById('taskDeadline').value = item.deadline;
  document.getElementById('taskStatus').value   = item.status;
  setText('taskModalTitle', 'Edit Tugas');
  showModal('taskModal');
}

/** Save (add or update) task from form */
function saveTask(e) {
  e.preventDefault();
  const id       = document.getElementById('taskId').value;
  const name     = document.getElementById('taskName').value.trim();
  const matkul   = document.getElementById('taskMatkul').value.trim();
  const desc     = document.getElementById('taskDesc').value.trim();
  const deadline = document.getElementById('taskDeadline').value;
  const status   = document.getElementById('taskStatus').value;

  const tasks = loadList(KEYS.tasks);

  if (id) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx !== -1) tasks[idx] = { id, name, matkul, desc, deadline, status };
    showToast('Tugas berhasil diperbarui ✅');
  } else {
    tasks.push({ id: genId(), name, matkul, desc, deadline, status });
    showToast('Tugas berhasil ditambahkan 🎉');
  }

  saveList(KEYS.tasks, tasks);
  closeTaskModal();
  renderTasks();
  if (currentPage === 'dashboard') renderDashboard();
}

/** Delete a task by ID */
function deleteTask(id) {
  if (!confirm('Hapus tugas ini?')) return;
  const tasks = loadList(KEYS.tasks).filter(t => t.id !== id);
  saveList(KEYS.tasks, tasks);
  renderTasks();
  showToast('Tugas dihapus.');
  if (currentPage === 'dashboard') renderDashboard();
}

function closeTaskModal() { hideModal('taskModal'); }

/* ==============================================
   6. KALENDER AKADEMIK (CALENDAR)
   ============================================== */

let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-indexed
let selectedDate = null;

/** Change month by offset (+1 or -1) */
function changeMonth(offset) {
  calMonth += offset;
  if (calMonth > 11) { calMonth = 0;  calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  renderCalendar();
}

/** Render the full calendar page */
function renderCalendar() {
  renderCalendarGrid();
  if (selectedDate) renderEventsForDate(selectedDate);
  else renderEventsSidebar([]);
}

/** Render the monthly grid */
function renderCalendarGrid() {
  const events = loadList(KEYS.events);
  const tasks  = loadList(KEYS.tasks);
  const today  = new Date();

  setText('calMonthYear', `${MONTHS_ID[calMonth]} ${calYear}`);

  const firstDay   = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const grid = document.getElementById('calendarGrid');

  let html = '';

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day other-month"><span></span></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr   = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday   = today.getDate() === d && today.getMonth() === calMonth && today.getFullYear() === calYear;
    const isSelected = selectedDate === dateStr;
    const hasEvent  = events.some(ev => ev.date === dateStr) || tasks.some(t => t.deadline === dateStr && t.status !== 'selesai');

    let cls = 'cal-day';
    if (isToday)    cls += ' today';
    if (isSelected && !isToday) cls += ' selected';
    if (hasEvent)   cls += ' has-event';

    html += `<div class="${cls}" onclick="selectCalDate('${dateStr}')"><span>${d}</span></div>`;
  }

  grid.innerHTML = html;
}

/** Handle date click on calendar */
function selectCalDate(dateStr) {
  selectedDate = dateStr;
  renderCalendarGrid();
  renderEventsForDate(dateStr);
}

/** Render events sidebar for a given date string */
function renderEventsForDate(dateStr) {
  const events = loadList(KEYS.events);
  const tasks  = loadList(KEYS.tasks);

  const dayEvents = events.filter(ev => ev.date === dateStr);
  const dayTasks  = tasks.filter(t  => t.deadline === dateStr && t.status !== 'selesai');

  const d = new Date(dateStr + 'T00:00:00');
  setText('eventDayTitle', `Kegiatan — ${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`);

  const container = document.getElementById('eventList');
  let html = '';

  if (dayEvents.length === 0 && dayTasks.length === 0) {
    html = `<p class="text-sm text-gray-400 text-center py-6">Tidak ada kegiatan di tanggal ini.</p>
            <button onclick="openEventModalWithDate('${dateStr}')" class="btn-primary w-full text-sm mt-2">+ Tambah Kegiatan</button>`;
  } else {
    html += dayEvents.map(ev => `
      <div class="p-3 rounded-xl border border-pink-100 bg-pink-50">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <span class="text-xs font-medium px-2 py-0.5 rounded-full badge-${ev.type}">${typeLabel(ev.type)}</span>
            <p class="font-semibold text-sm text-gray-700 mt-1">${esc(ev.name)}</p>
            ${ev.note ? `<p class="text-xs text-gray-400 mt-0.5">${esc(ev.note)}</p>` : ''}
          </div>
          <button onclick="deleteEvent('${ev.id}')" class="btn-danger text-xs px-2 py-1 flex-shrink-0">Hapus</button>
        </div>
      </div>
    `).join('');

    html += dayTasks.map(t => `
      <div class="p-3 rounded-xl border border-red-100 bg-red-50">
        <span class="text-xs font-medium px-2 py-0.5 rounded-full badge-deadline">Deadline Tugas</span>
        <p class="font-semibold text-sm text-gray-700 mt-1">${esc(t.name)}</p>
        <p class="text-xs text-gray-400 mt-0.5">${esc(t.matkul)}</p>
      </div>
    `).join('');

    html += `<button onclick="openEventModalWithDate('${dateStr}')" class="btn-secondary w-full text-sm mt-2">+ Tambah Kegiatan</button>`;
  }

  container.innerHTML = html;
}

/** Render empty state for event sidebar */
function renderEventsSidebar(items) {
  document.getElementById('eventList').innerHTML = `<p class="text-sm text-gray-400 text-center py-4">Klik tanggal untuk melihat kegiatan.</p>`;
  setText('eventDayTitle', 'Kegiatan');
}

/** Open event modal */
function openEventModal() {
  document.getElementById('eventId').value = '';
  document.getElementById('eventForm').reset();
  if (selectedDate) document.getElementById('eventDate').value = selectedDate;
  setText('eventModalTitle', 'Tambah Kegiatan');
  showModal('eventModal');
}

/** Open event modal with pre-filled date */
function openEventModalWithDate(dateStr) {
  openEventModal();
  document.getElementById('eventDate').value = dateStr;
}

/** Save a calendar event */
function saveEvent(e) {
  e.preventDefault();
  const id   = document.getElementById('eventId').value;
  const name = document.getElementById('eventName').value.trim();
  const date = document.getElementById('eventDate').value;
  const type = document.getElementById('eventType').value;
  const note = document.getElementById('eventNote').value.trim();

  const events = loadList(KEYS.events);

  if (id) {
    const idx = events.findIndex(ev => ev.id === id);
    if (idx !== -1) events[idx] = { id, name, date, type, note };
    showToast('Kegiatan diperbarui ✅');
  } else {
    events.push({ id: genId(), name, date, type, note });
    showToast('Kegiatan ditambahkan 🎉');
  }

  saveList(KEYS.events, events);
  closeEventModal();
  selectedDate = date;
  renderCalendar();
}

/** Delete a calendar event */
function deleteEvent(id) {
  if (!confirm('Hapus kegiatan ini?')) return;
  const events = loadList(KEYS.events).filter(ev => ev.id !== id);
  saveList(KEYS.events, events);
  renderCalendar();
  showToast('Kegiatan dihapus.');
}

function closeEventModal() { hideModal('eventModal'); }

/** Map event type key to label */
function typeLabel(type) {
  return { ujian: '📝 Ujian', deadline: '⚠️ Deadline', kegiatan: '📌 Kegiatan' }[type] || type;
}

/* ==============================================
   7. ASISTEN MY KAMPUS (CHAT ASSISTANT)
   ============================================== */

/** Add a message bubble to the chat window */
function addMessage(text, sender = 'bot') {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `bubble-${sender}`;

  if (sender === 'bot') {
    div.innerHTML = `
      <div class="bot-avatar">MK</div>
      <div class="bubble-inner">${text}</div>`;
  } else {
    div.innerHTML = `<div class="bubble-inner">${esc(text)}</div>`;
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

/** Handle send from input field */
function sendChat() {
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text) return;
  input.value = '';
  addMessage(text, 'user');
  const reply = generateReply(text);
  setTimeout(() => addMessage(reply, 'bot'), 400);
}

/** Handle suggestion chip click */
function sendSuggestion(btn) {
  // Strip leading emojis/symbols to get clean keyword text for matching
  const text = btn.textContent.replace(/^[\p{Emoji}\s]+/u, '').trim();
  addMessage(btn.textContent, 'user');
  const reply = generateReply(text);
  setTimeout(() => addMessage(reply, 'bot'), 400);
}

/**
 * Generate a text reply based on user input.
 * Uses keyword matching against LocalStorage data.
 * NOT connected to any AI/LLM.
 */
function generateReply(input) {
  const lower     = input.toLowerCase();
  const schedules = loadList(KEYS.schedules);
  const tasks     = loadList(KEYS.tasks);
  const profile   = loadObj(KEYS.profile, { name: 'Mahasiswa' });
  const now       = new Date();
  const todayName = DAYS_ID[now.getDay()];

  // --- Jadwal hari ini ---
  if (lower.includes('jadwal hari ini') || lower.includes('kelas hari ini') || lower.includes('kuliah hari ini')) {
    const today = [...schedules.filter(s => s.hari === todayName)].sort((a,b) => a.mulai.localeCompare(b.mulai));
    if (today.length === 0) return `Hari ini (${todayName}) kamu tidak ada kelas. Selamat bersantai! 😊`;
    return `Jadwal kuliah kamu hari ini (<b>${todayName}</b>):<br>${today.map(s => `📍 <b>${esc(s.matkul)}</b> — ${s.mulai}–${s.selesai} di ${esc(s.ruang)}`).join('<br>')}`;
  }

  // --- Kelas berikutnya ---
  if (lower.includes('kelas berikutnya') || lower.includes('kuliah berikutnya') || lower.includes('next class')) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const todayClasses = schedules
      .filter(s => s.hari === todayName)
      .filter(s => {
        const [h, m] = s.mulai.split(':').map(Number);
        return h * 60 + m > nowMinutes;
      })
      .sort((a, b) => a.mulai.localeCompare(b.mulai));
    if (todayClasses.length === 0) return `Tidak ada kelas lagi hari ini (${todayName}). Hari yang produktif! 🌟`;
    const next = todayClasses[0];
    return `Kelas berikutnya kamu:<br>📚 <b>${esc(next.matkul)}</b><br>⏰ ${next.mulai}–${next.selesai}<br>📍 ${esc(next.ruang)}<br>👨‍🏫 ${esc(next.dosen)}`;
  }

  // --- Daftar tugas ---
  if (lower.includes('daftar tugas') || lower.includes('list tugas') || lower.includes('tugas saya')) {
    const pending = tasks.filter(t => t.status !== 'selesai');
    if (pending.length === 0) return 'Kamu tidak memiliki tugas yang belum dikerjakan. Luar biasa! 🎉';
    return `Tugas yang belum dikerjakan (${pending.length}):<br>${pending.slice(0,5).map(t => `📝 <b>${esc(t.name)}</b> — ${esc(t.matkul)} · Deadline: ${formatDate(t.deadline)}`).join('<br>')}${pending.length > 5 ? `<br>...dan ${pending.length - 5} tugas lainnya.` : ''}`;
  }

  // --- Deadline dekat ---
  if (lower.includes('deadline') || lower.includes('batas waktu') || lower.includes('pengumpulan')) {
    const near = tasks.filter(t => t.status !== 'selesai' && daysUntil(t.deadline) <= 7 && daysUntil(t.deadline) >= 0)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    if (near.length === 0) return 'Tidak ada deadline dalam 7 hari ke depan. 👍';
    return `Deadline mendekat dalam 7 hari:<br>${near.map(t => {
      const d = daysUntil(t.deadline);
      return `⚠️ <b>${esc(t.name)}</b> (${esc(t.matkul)})<br>   → ${d === 0 ? 'Hari ini!' : d === 1 ? 'Besok!' : `${d} hari lagi`} — ${formatDate(t.deadline)}`;
    }).join('<br>')}`;
  }

  // --- Ringkasan jadwal ---
  if (lower.includes('ringkasan') || lower.includes('semua jadwal') || lower.includes('total')) {
    const days  = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const total = schedules.length;
    if (total === 0) return 'Kamu belum memiliki jadwal kuliah yang tersimpan.';
    const perDay = days.map(d => {
      const cnt = schedules.filter(s => s.hari === d).length;
      return cnt > 0 ? `${d}: ${cnt} kelas` : null;
    }).filter(Boolean);
    return `Ringkasan jadwal kamu:<br>📊 Total ${total} sesi kuliah<br>${perDay.join('<br>')}`;
  }

  // --- Profil ---
  if (lower.includes('siapa saya') || lower.includes('profil saya') || lower.includes('nama saya')) {
    return `Profil kamu:<br>👤 <b>${esc(profile.name || '-')}</b><br>🎓 NIM: ${esc(profile.nim || '-')}<br>📚 ${esc(profile.prodi || '-')}<br>📅 Semester ${esc(profile.sem || '-')}`;
  }

  // --- Help ---
  if (lower.includes('halo') || lower.includes('hai') || lower.includes('hello') || lower.includes('hi')) {
    return `Halo, ${esc(profile.name || 'kamu')}! 👋 Saya Asisten MY KAMPUS.<br><br>Saya bisa membantu kamu dengan:<br>• Jadwal kuliah hari ini<br>• Kelas berikutnya<br>• Daftar tugas<br>• Deadline mendekat<br>• Ringkasan jadwal`;
  }
  if (lower.includes('bantuan') || lower.includes('help') || lower.includes('bisa apa')) {
    return `Saya dapat membantu kamu dengan:<br>• <i>"Jadwal hari ini"</i><br>• <i>"Kelas berikutnya"</i><br>• <i>"Daftar tugas"</i><br>• <i>"Deadline dekat"</i><br>• <i>"Ringkasan jadwal"</i><br><br>💡 Catatan: Asisten ini berbasis data lokal kamu, bukan AI sungguhan.`;
  }

  // --- Cari mata kuliah tertentu ---
  const matchedSchedule = schedules.find(s => lower.includes(s.matkul.toLowerCase()));
  if (matchedSchedule) {
    return `Informasi mata kuliah <b>${esc(matchedSchedule.matkul)}</b>:<br>👨‍🏫 Dosen: ${esc(matchedSchedule.dosen)}<br>📅 Hari: ${matchedSchedule.hari}<br>⏰ ${matchedSchedule.mulai}–${matchedSchedule.selesai}<br>📍 Ruang: ${esc(matchedSchedule.ruang)}`;
  }

  // --- Fallback ---
  return `Maaf, saya tidak mengerti pertanyaan kamu. 🤔<br>Coba tanyakan:<br>• "Jadwal hari ini"<br>• "Kelas berikutnya"<br>• "Daftar tugas"<br>• "Deadline dekat"`;
}

/** Show initial welcome message in chat */
function initAssistant() {
  const profile = loadObj(KEYS.profile, { name: 'Mahasiswa' });
  addMessage(`Halo, <b>${esc(profile.name || 'Mahasiswa')}</b>! 👋 Saya Asisten MY KAMPUS.<br><br>Saya siap membantu kamu mencari informasi jadwal kuliah dan tugas berdasarkan data yang kamu simpan.<br><br>💡 <i>Catatan: Asisten ini berbasis data lokal, bukan AI sungguhan.</i>`, 'bot');
}

/* ==============================================
   8. PROFIL MAHASISWA (PROFILE)
   ============================================== */

/** Render profile page from saved data */
function renderProfile() {
  const p = loadObj(KEYS.profile, { name: 'Mahasiswa', nim: '', prodi: '', sem: '1' });

  setVal('profileName',  p.name  || '');
  setVal('profileNim',   p.nim   || '');
  setVal('profileProdi', p.prodi || '');
  setVal('profileSem',   p.sem   || '1');

  updateProfileDisplay(p);
}

/** Update display elements from profile data */
function updateProfileDisplay(p) {
  const initials = (p.name || 'M').charAt(0).toUpperCase();
  setText('profileAvatar',      initials);
  setText('sidebarAvatar',      initials);
  setText('headerAvatar',       initials);
  setText('profileNameDisplay', p.name  || 'Mahasiswa');
  setText('profileNimDisplay',  `NIM: ${p.nim  || '-'}`);
  setText('profileProdiDisplay',p.prodi || '-');
  setText('profileSemDisplay',  `Semester ${p.sem || '-'}`);
  setText('sidebarName',        p.name  || 'Mahasiswa');
  setText('sidebarNim',         `NIM: ${p.nim || '-'}`);
}

/** Save profile form */
function saveProfile(e) {
  e.preventDefault();
  const p = {
    name  : document.getElementById('profileName').value.trim(),
    nim   : document.getElementById('profileNim').value.trim(),
    prodi : document.getElementById('profileProdi').value.trim(),
    sem   : document.getElementById('profileSem').value,
  };
  localStorage.setItem(KEYS.profile, JSON.stringify(p));
  updateProfileDisplay(p);
  showToast('Profil berhasil disimpan ✅');
}

/* ==============================================
   9. UTILITIES
   ============================================== */

/** Set textContent of an element by ID */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/** Set value of a form element by ID */
function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

/** Escape HTML to prevent XSS */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Calculate days between today and a date string */
function daysUntil(dateStr) {
  const today  = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

/** Format a date string to Indonesian short format */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

/** Show a modal */
function showModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

/** Hide a modal */
function hideModal(id) {
  document.getElementById(id).classList.add('hidden');
}

/** Show a toast notification for 3 seconds */
let toastTimeout = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  setText('toastMsg', message);
  toast.classList.remove('hidden');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), 3000);
}

/* ==============================================
   10. INIT — Bootstrap on DOM Ready
   ============================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  initNavigation();
  initDayFilter();

  // Load profile into sidebar/header
  const profile = loadObj(KEYS.profile, { name: 'Mahasiswa', nim: '', prodi: '', sem: '1' });
  updateProfileDisplay(profile);

  // Set header date
  const now = new Date();
  setText('headerDate', `${now.getDate()} ${MONTHS_ID[now.getMonth()]} ${now.getFullYear()}`);

  // Render initial page
  renderDashboard();

  // Init assistant welcome message
  initAssistant();

  // Close modals on overlay click
  ['scheduleModal', 'taskModal', 'eventModal'].forEach(id => {
    document.getElementById(id).addEventListener('click', function(e) {
      if (e.target === this) hideModal(id);
    });
  });

  console.log('%cMY KAMPUS v1.0 — Ready!', 'color:#ec4899;font-weight:bold;font-size:14px;');
});
