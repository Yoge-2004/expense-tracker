/**
 * Expense Tracker Pro - Enterprise Command Center Engine
 * Multi-role RBAC, Telemetry HUD, Deep Security Drawer, ML Governance & Broadcast Studio
 */

(function () {
    "use strict";

    // ── Authentication & Security Guard ──────────────────────────────────────
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.replace("index.html");
        return;
    }

    let permissions = null;
    let autoRefreshTimer = null;
    let flowChart = null;
    let currentFlowDays = 30;

    let userPage = 0;
    const userPageSize = 15;
    let auditPage = 0;
    const auditPageSize = 15;

    let selectedDrawerUserId = null;
    let pendingStepUpAction = null;
    let searchTimer = null;

    // ── Initialization ───────────────────────────────────────────────────────
    document.addEventListener("DOMContentLoaded", async () => {
        setupNavigation();
        setupAutoRefresh();
        setupInteractiveMockup();
        setupEventListeners();

        // Enhance native select elements with luxury custom controls
        if (typeof window.initAllCustomSelects === "function") {
            window.initAllCustomSelects();
        }

        // Listen for global theme toggles so the Chart updates dynamically
        document.addEventListener("themechange", () => {
            if (flowChart) loadFlowChart(currentFlowDays);
        });

        try {
            await loadPermissions();
            await loadMissionControl();
            await loadTelemetryHud();
            await loadFlowChart(30);
            await loadDatabaseTopology();
        } catch (err) {
            console.error("Initial load failure:", err);
            handleUnauthorized(err);
        }
    });

    // ── RBAC & Permissions ───────────────────────────────────────────────────
    async function loadPermissions() {
        try {
            permissions = await apiRequest("/admin/me/permissions");
            if (!permissions || (permissions.role !== "ROLE_ADMIN" && permissions.role !== "ROLE_SUPER_ADMIN")) {
                handleUnauthorized({ status: 403 });
                return;
            }

            const nameEl = document.getElementById("sidebarOperatorName");
            const roleEl = document.getElementById("sidebarOperatorRole");
            const avatarEl = document.getElementById("sidebarAvatar");

            if (nameEl) nameEl.textContent = permissions.username || "Operator";
            if (roleEl) roleEl.textContent = permissions.role || "ROLE_ADMIN";
            if (avatarEl) avatarEl.textContent = (permissions.username || "A").charAt(0).toUpperCase();

            // Adaptively hide/disable Super Admin only controls
            if (!permissions.canModifyRoles) {
                const superSec = document.getElementById("drawerSuperAdminSection");
                if (superSec) superSec.style.display = "none";
            }
            if (!permissions.canTriggerFailover) {
                const failoverBtn = document.getElementById("triggerFailoverSnapshotBtn");
                if (failoverBtn) failoverBtn.disabled = true;
            }
            if (!permissions.canBroadcastNotifications) {
                const broadcastBtn = document.getElementById("sendBroadcastBtn");
                if (broadcastBtn) broadcastBtn.disabled = true;
            }
        } catch (e) {
            handleUnauthorized(e);
        }
    }

    function handleUnauthorized(err) {
        if (err?.status === 403 || err?.status === 401) {
            alert("Access Denied: You do not possess the required administrative clearance to access this console.");
            window.location.replace("dashboard.html");
        }
    }

    // ── Navigation & Tabs ────────────────────────────────────────────────────
    function setupNavigation() {
        const navItems = document.querySelectorAll(".admin-nav-item");
        const views = document.querySelectorAll(".admin-content-view");
        const topbarTitle = document.getElementById("topbarTitle");
        const topbarSubtitle = document.getElementById("topbarSubtitle");

        const tabMetadata = {
            overviewTab: { title: "Mission Control", sub: "Platform KPIs, live telemetry, and cash flow velocity" },
            usersTab: { title: "User Security & Directory", sub: "Search, moderate, inspect PIN lockouts, and manage account privileges" },
            logsTab: { title: "Application Logs & Observability", sub: "Live server event stream, error diagnostics, and kernel buffer inspection" },
            mlTab: { title: "ML & AI Governance", sub: "Model accuracy, interactive inference sandbox, and user correction queue" },
            broadcastTab: { title: "Broadcast Studio", sub: "Compose platform-wide push alerts with real-time mobile preview" },
            resilienceTab: { title: "Resilience & Ops", sub: "3-tier database cluster state, failover snapshots & cache oversight" },
            databaseTab: { title: "Platform Database & Financial Ledgers", sub: "Inspect all user expenses, incomes, and multi-tenant ledger data" },
            auditTab: { title: "Compliance Audit Trail", sub: "Immutable non-repudiation records and CSV export for regulatory oversight" }
        };

        navItems.forEach(item => {
            item.addEventListener("click", () => {
                const targetId = item.getAttribute("data-tab");
                navItems.forEach(i => i.classList.remove("active"));
                views.forEach(v => {
                    v.classList.remove("active");
                    v.style.display = "none";
                });

                item.classList.add("active");
                const targetView = document.getElementById(targetId);
                if (targetView) {
                    targetView.classList.add("active");
                    targetView.style.display = "block";
                }

                if (tabMetadata[targetId] && topbarTitle && topbarSubtitle) {
                    topbarTitle.textContent = tabMetadata[targetId].title;
                    topbarSubtitle.textContent = tabMetadata[targetId].sub;
                }

                // Lazy load
                if (targetId === "usersTab") loadUsersDirectory();
                if (targetId === "logsTab") loadApplicationLogs();
                if (targetId === "mlTab") { loadMlStats(); loadMlFeedbackQueue(); }
                if (targetId === "resilienceTab") { loadResilienceDiagnostics(); loadDatabaseTopology(); }
                if (targetId === "databaseTab") loadPlatformDatabase();
                if (targetId === "auditTab") loadAuditLogs();

                // Keep clicked tab in view
                item.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });

                // Re-initialize custom dropdown selects whenever views become visible
                setTimeout(() => {
                    if (typeof window.initAllCustomSelects === "function") {
                        window.initAllCustomSelects();
                    }
                }, 40);
            });
        });

        // Initialize taskbar horizontal scroll controls & chevrons
        const tabsNav = document.getElementById("adminStreamTabs");
        const scrollLeftBtn = document.getElementById("adminNavScrollLeft");
        const scrollRightBtn = document.getElementById("adminNavScrollRight");

        function updateScrollButtons() {
            if (!tabsNav) return;
            const scrollLeft = Math.ceil(tabsNav.scrollLeft);
            const maxScroll = Math.max(0, tabsNav.scrollWidth - tabsNav.clientWidth);

            if (maxScroll <= 4) {
                // All tabs comfortably fit within view
                if (scrollLeftBtn) scrollLeftBtn.style.display = "none";
                if (scrollRightBtn) scrollRightBtn.style.display = "none";
                return;
            }

            if (scrollLeftBtn) {
                scrollLeftBtn.style.display = "inline-flex";
                scrollLeftBtn.disabled = scrollLeft <= 4;
            }
            if (scrollRightBtn) {
                scrollRightBtn.style.display = "inline-flex";
                scrollRightBtn.disabled = scrollLeft >= (maxScroll - 4);
            }
        }

        if (tabsNav) {
            tabsNav.addEventListener("scroll", updateScrollButtons, { passive: true });
            window.addEventListener("resize", updateScrollButtons);
            setTimeout(updateScrollButtons, 50);
            setTimeout(updateScrollButtons, 200);
            setTimeout(updateScrollButtons, 600);

            // Smooth wheel scroll (handling both deltaX and deltaY)
            tabsNav.addEventListener("wheel", (e) => {
                if (tabsNav.scrollWidth > tabsNav.clientWidth) {
                    const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
                    if (delta !== 0) {
                        e.preventDefault();
                        tabsNav.scrollLeft += (delta * 1.25);
                        updateScrollButtons();
                    }
                }
            }, { passive: false });

            const scrollStep = 240;
            scrollLeftBtn?.addEventListener("click", () => {
                if (typeof tabsNav.scrollBy === "function") {
                    tabsNav.scrollBy({ left: -scrollStep, behavior: "smooth" });
                } else {
                    tabsNav.scrollLeft -= scrollStep;
                }
                setTimeout(updateScrollButtons, 320);
            });
            scrollRightBtn?.addEventListener("click", () => {
                if (typeof tabsNav.scrollBy === "function") {
                    tabsNav.scrollBy({ left: scrollStep, behavior: "smooth" });
                } else {
                    tabsNav.scrollLeft += scrollStep;
                }
                setTimeout(updateScrollButtons, 320);
            });

            // Desktop mouse drag-to-scroll support
            let isDragging = false;
            let startMouseX = 0;
            let initialScroll = 0;

            tabsNav.addEventListener("mousedown", (e) => {
                if (e.target.closest("button")) return;
                isDragging = true;
                startMouseX = e.pageX - tabsNav.offsetLeft;
                initialScroll = tabsNav.scrollLeft;
                tabsNav.style.cursor = "grabbing";
            });

            window.addEventListener("mouseup", () => {
                if (isDragging) {
                    isDragging = false;
                    tabsNav.style.cursor = "";
                    updateScrollButtons();
                }
            });

            tabsNav.addEventListener("mousemove", (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const x = e.pageX - tabsNav.offsetLeft;
                const walk = (x - startMouseX) * 1.4;
                tabsNav.scrollLeft = initialScroll - walk;
                updateScrollButtons();
            });
        }
    }

    // ── Auto-Refresh Orchestrator ────────────────────────────────────────────
    function setupAutoRefresh() {
        const sel = document.getElementById("autoRefreshSelector");
        if (!sel) return;

        sel.addEventListener("change", (e) => {
            const intervalMs = parseInt(e.target.value, 10);
            if (autoRefreshTimer) clearInterval(autoRefreshTimer);

            if (intervalMs > 0) {
                autoRefreshTimer = setInterval(pollTelemetry, intervalMs);
                showToast(`Live polling active (${intervalMs / 1000}s)`, "info");
            } else {
                showToast("Live polling paused", "info");
            }
        });

        // Default 30s
        autoRefreshTimer = setInterval(pollTelemetry, 30000);
    }

    async function pollTelemetry() {
        try {
            const pill = document.getElementById("heartbeatPill");
            const text = document.getElementById("heartbeatText");
            if (pill) pill.className = "status-badge badge-netflow";
            if (text) text.textContent = "Syncing…";

            await Promise.all([
                loadMissionControl(),
                loadTelemetryHud()
            ]);

            const activeTab = document.querySelector(".admin-nav-item.active")?.getAttribute("data-tab");
            if (activeTab === "logsTab") {
                loadApplicationLogs();
            }

            if (pill) pill.className = "status-badge badge-success";
            if (text) text.textContent = "Telemetry Online";
        } catch (e) {
            const pill = document.getElementById("heartbeatPill");
            const text = document.getElementById("heartbeatText");
            if (pill) pill.className = "status-badge badge-warning";
            if (text) text.textContent = "Telemetry Degraded";
        }
    }

    // ── Mission Control KPI Metrics ──────────────────────────────────────────
    async function loadMissionControl() {
        try {
            const summary = await apiRequest("/admin/metrics/summary");
            if (!summary) return;

            document.getElementById("metricTotalUsers").textContent = (summary.totalUsers || 0).toLocaleString();
            document.getElementById("metricActiveUsersSub").textContent = `${(summary.activeUsers || 0).toLocaleString()} Active`;
            document.getElementById("metricLockedUsers").textContent = (summary.lockedUsers || 0).toLocaleString();

            document.getElementById("metricExpenseAmount").textContent = formatCurrency(summary.totalExpenseVolume);
            document.getElementById("metricExpenseCountSub").textContent = `${(summary.totalExpenseCount || 0).toLocaleString()} debits`;

            document.getElementById("metricIncomeAmount").textContent = formatCurrency(summary.totalIncomeVolume);

            // Update badge on nav tab
            const userBadge = document.getElementById("navUsersCount");
            if (userBadge) userBadge.textContent = summary.totalUsers || 0;

        } catch (e) {
            console.error("Mission control error:", e);
        }
    }

    async function loadTelemetryHud() {
        try {
            const tel = await apiRequest("/admin/system/telemetry");
            if (!tel) return;

            // Process & System CPU
            const procCpu = Math.round(Number(tel.processCpuPercent ?? 0));
            const sysCpu = Math.round(Number(tel.systemCpuPercent ?? 0));
            const cpuProcEl = document.getElementById("hudCpuProcess");
            const cpuSysEl = document.getElementById("hudCpuSystem");
            const cpuBarEl = document.getElementById("hudCpuBar");
            if (cpuProcEl) cpuProcEl.textContent = `${procCpu}%`;
            if (cpuSysEl) cpuSysEl.textContent = `${sysCpu}%`;
            if (cpuBarEl) cpuBarEl.style.width = `${Math.min(100, Math.max(3, procCpu))}%`;

            // System Physical RAM
            const ramUsed = Number(tel.physicalRamUsedMb ?? 0);
            const ramTotal = Number(tel.physicalRamTotalMb ?? 0);
            const ramUsedEl = document.getElementById("hudRamUsed");
            const ramTotalEl = document.getElementById("hudRamTotal");
            const ramBarEl = document.getElementById("hudRamBar");
            if (ramUsedEl) ramUsedEl.textContent = ramUsed.toLocaleString();
            if (ramTotalEl) ramTotalEl.textContent = ramTotal.toLocaleString();
            if (ramBarEl && ramTotal > 0) {
                const ramPct = Math.min(100, Math.round((ramUsed / ramTotal) * 100));
                ramBarEl.style.width = `${Math.max(3, ramPct)}%`;
            }

            // JVM Heap Allocation
            const heapUsed = Number(tel.heapUsedMb ?? 0);
            const heapMax = Number(tel.heapMaxMb ?? 0);
            const heapUsedEl = document.getElementById("hudHeapUsed");
            const heapMaxEl = document.getElementById("hudHeapMax");
            const heapBarEl = document.getElementById("hudHeapBar");
            if (heapUsedEl) heapUsedEl.textContent = heapUsed.toLocaleString();
            if (heapMaxEl) heapMaxEl.textContent = heapMax.toLocaleString();
            if (heapBarEl && heapMax > 0) {
                const heapPercent = Math.min(100, Math.round((heapUsed / heapMax) * 100));
                heapBarEl.style.width = `${Math.max(3, heapPercent)}%`;
            }

            // Disk Storage Capacity
            const diskUsed = Number(tel.diskUsedGb ?? 0);
            const diskTotal = Number(tel.diskTotalGb ?? 0);
            const diskFree = Number(tel.diskFreeGb ?? 0);
            const diskUsedEl = document.getElementById("hudDiskUsed");
            const diskTotalEl = document.getElementById("hudDiskTotal");
            const diskFreeEl = document.getElementById("hudDiskFree");
            const diskBarEl = document.getElementById("hudDiskBar");
            if (diskUsedEl) diskUsedEl.textContent = diskUsed;
            if (diskTotalEl) diskTotalEl.textContent = diskTotal;
            if (diskFreeEl) diskFreeEl.textContent = diskFree;
            if (diskBarEl && diskTotal > 0) {
                const diskPct = Math.min(100, Math.round((diskUsed / diskTotal) * 100));
                diskBarEl.style.width = `${Math.max(3, diskPct)}%`;
            }

            // HikariCP Saturation
            const activeConns = Number(tel.hikariActiveConnections ?? 0);
            const totalConns = Number(tel.hikariTotalConnections ?? 10);
            const maxPool = Number(tel.hikariMaxPoolSize ?? totalConns ?? 20);
            const activeConnsEl = document.getElementById("hudActiveConns");
            const totalConnsEl = document.getElementById("hudTotalConns");
            const maxPoolEl = document.getElementById("hudMaxPool");
            const connBarEl = document.getElementById("hudHikariBar");
            if (activeConnsEl) activeConnsEl.textContent = activeConns;
            if (totalConnsEl) totalConnsEl.textContent = totalConns;
            if (maxPoolEl) maxPoolEl.textContent = maxPool;
            if (connBarEl && maxPool > 0) {
                const connPercent = Math.min(100, Math.round((activeConns / maxPool) * 100));
                connBarEl.style.width = `${Math.max(5, connPercent)}%`;
            }

            // Engine & Host details
            const dbProductEl = document.getElementById("hudDbProduct");
            if (dbProductEl) dbProductEl.textContent = tel.databaseProductName || "PostgreSQL";

            const osNameEl = document.getElementById("hudOsName");
            if (osNameEl) osNameEl.textContent = tel.osName || "Linux";

            const threadsDetailEl = document.getElementById("hudThreadsDetail");
            if (threadsDetailEl) {
                const live = tel.liveThreadCount ?? "--";
                const peak = tel.peakThreadCount ?? "--";
                threadsDetailEl.textContent = `${live} live (${peak} peak)`;
            }

            const uptimeSec = Number(tel.uptimeSeconds || 0);
            const hours = Math.floor(uptimeSec / 3600);
            const minutes = Math.floor((uptimeSec % 3600) / 60);
            const uptimeEl = document.getElementById("hudUptime");
            if (uptimeEl) {
                uptimeEl.textContent = hours > 0 ? `Uptime: ${hours}h ${minutes}m` : `Uptime: ${minutes}m`;
            }
        } catch (e) {
            console.error("Telemetry HUD error:", e);
        }
    }

    // ── Volume Trends Chart ──────────────────────────────────────────────────
    window.switchTrendsDays = async function (days) {
        currentFlowDays = days;
        await loadFlowChart(days);
    };

    async function loadFlowChart(days) {
        try {
            const data = await apiRequest(`/admin/metrics/trends?days=${days}`);
            if (!Array.isArray(data)) return;

            const labels = data.map(d => d.date);
            const outflows = data.map(d => Number(d.expenseAmount || 0));
            const inflows = data.map(d => Number(d.incomeAmount || 0));

            const canvas = document.getElementById("adminFlowChart");
            if (!canvas) return;

            if (flowChart) flowChart.destroy();

            const isLight = document.documentElement.getAttribute("data-theme") === "light";
            const gridColor = isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.05)";
            const textColor = isLight ? "#475569" : "#A8A395";
            const tooltipBg = isLight ? "#FFFFFF" : "#171A14";
            const tooltipTitleColor = isLight ? "#0F172A" : "#ECE7D8";
            const tooltipBorder = isLight ? "rgba(212, 175, 55, 0.35)" : "rgba(199, 154, 62, 0.35)";

            flowChart = new Chart(canvas, {
                type: "line",
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: "Platform Outflow (₹)",
                            data: outflows,
                            borderColor: isLight ? "#DC2626" : "#EF4444",
                            backgroundColor: isLight ? "rgba(220, 38, 38, 0.08)" : "rgba(239, 68, 68, 0.08)",
                            borderWidth: 2,
                            fill: true,
                            tension: 0.35,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        },
                        {
                            label: "Platform Inflow (₹)",
                            data: inflows,
                            borderColor: isLight ? "#059669" : "#10B981",
                            backgroundColor: isLight ? "rgba(5, 150, 105, 0.08)" : "rgba(16, 185, 129, 0.08)",
                            borderWidth: 2,
                            fill: true,
                            tension: 0.35,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: textColor,
                                font: { family: "'Hanken Grotesk', sans-serif", weight: 600 }
                            }
                        },
                        tooltip: {
                            backgroundColor: tooltipBg,
                            borderColor: tooltipBorder,
                            borderWidth: 1,
                            titleColor: tooltipTitleColor,
                            bodyColor: isLight ? "#B45309" : "#C79A3E"
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: { color: textColor, maxTicksLimit: 12 }
                        },
                        y: {
                            grid: { color: gridColor },
                            ticks: {
                                color: textColor,
                                callback: val => "₹" + (val >= 1000 ? (val / 1000).toFixed(0) + "k" : val)
                            }
                        }
                    }
                }
            });
        } catch (e) {
            console.error("Chart load error:", e);
        }
    }

    // ── User Directory & Security Moderation (Full CRUD) ──────────────────────
    async function loadUsersDirectory() {
        const query = document.getElementById("userDirectorySearch")?.value?.trim() || "";
        const role = document.getElementById("userRoleFilterSelect")?.value || "";
        const tbody = document.getElementById("userTableBody");
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-muted);">Querying secured user registry…</td></tr>`;

        try {
            let url = `/admin/users?page=${userPage}&size=${userPageSize}`;
            if (query) url += `&query=${encodeURIComponent(query)}`;
            if (role) url += `&role=${encodeURIComponent(role)}`;

            const data = await apiRequest(url);
            if (!data || !Array.isArray(data.content) || data.content.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-muted);">No users match the search criteria.</td></tr>`;
                return;
            }

            tbody.innerHTML = "";
            populateDbUserFilter(data.content);
            data.content.forEach(u => {
                const tr = document.createElement("tr");

                const isLocked = u.accountLocked;
                const statusHtml = isLocked
                    ? `<span class="status-badge badge-subs">● Locked</span>`
                    : `<span class="status-badge badge-success">● Active</span>`;

                const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—";

                tr.innerHTML = `
                    <td style="font-family:var(--font-mono); color:var(--text-muted);">#${escapeHtml(u.id)}</td>
                    <td>
                        <strong style="color:var(--text-main);">${escapeHtml(u.name || "Unnamed")}</strong>
                        <div style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">@${escapeHtml(u.username || "—")}</div>
                    </td>
                    <td style="color:var(--text-muted);">${escapeHtml(u.email)}</td>
                    <td><span class="status-badge badge-netflow">${escapeHtml(u.role)}</span></td>
                    <td>${statusHtml}</td>
                    <td style="font-family:var(--font-mono); color:var(--text-main); font-weight:600;">${u.expenseCount || 0}</td>
                    <td style="color:var(--text-muted); font-size:12px;">${dateStr}</td>
                    <td style="text-align:right;">
                        <div style="display:inline-flex; gap:6px; align-items:center;">
                            <button class="btn-secondary" style="padding:5px 10px; font-size:11px; font-weight:600;" data-action="inspect" data-id="${u.id}" title="Inspect Details & Security">
                                Inspect
                            </button>
                            <button class="btn-secondary" style="padding:5px 10px; font-size:11px; font-weight:600;" data-action="edit" data-id="${u.id}" title="Edit Account">
                                Edit
                            </button>
                            <button class="btn-danger" style="padding:5px 10px; font-size:11px; font-weight:600; background:rgba(239, 68, 68, 0.15); color:var(--danger, #EF4444); border:1px solid rgba(239, 68, 68, 0.3); border-radius:8px;" data-action="delete" data-id="${u.id}" data-name="${escapeHtml(u.name || u.username)}" title="Delete User">
                                Delete
                            </button>
                        </div>
                    </td>
                `;

                // Row action dispatch
                tr.addEventListener("click", (e) => {
                    const btn = e.target.closest("button[data-action]");
                    if (btn) {
                        e.stopPropagation();
                        const action = btn.dataset.action;
                        const uid = Number(btn.dataset.id);
                        if (action === "inspect") {
                            openUserDrawer(uid);
                        } else if (action === "edit") {
                            openEditUserModal(uid);
                        } else if (action === "delete") {
                            const name = btn.dataset.name || `User #${uid}`;
                            confirmDeleteUser(uid, name);
                        }
                        return;
                    }
                    openUserDrawer(u.id);
                });

                tbody.appendChild(tr);
            });

            // Pagination Controls
            const totalPages = data.totalPages || 1;
            document.getElementById("userPaginationLabel").textContent =
                `Page ${userPage + 1} of ${totalPages} (${data.totalElements || 0} accounts)`;
            document.getElementById("userPrevBtn").disabled = userPage <= 0;
            document.getElementById("userNextBtn").disabled = userPage >= totalPages - 1;

        } catch (e) {
            console.error("User directory load error:", e);
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--accent-text);">Failed to load user directory.</td></tr>`;
        }
    }

    async function openUserDrawer(userId) {
        selectedDrawerUserId = userId;
        const drawer = document.getElementById("userDrawer");
        const overlay = document.getElementById("drawerOverlay");

        try {
            const d = await apiRequest(`/admin/users/${userId}/details`);
            if (!d) return;

            document.getElementById("drawerName").textContent = d.name || "Unnamed User";
            document.getElementById("drawerEmail").textContent = `${d.email} (@${d.username || "—"})`;
            document.getElementById("drawerAvatar").textContent = (d.name || "U").charAt(0).toUpperCase();

            const roleBadge = document.getElementById("drawerRoleBadge");
            roleBadge.textContent = d.role;

            const statusBadge = document.getElementById("drawerStatusBadge");
            statusBadge.className = d.accountLocked ? "status-badge badge-subs" : "status-badge badge-success";
            statusBadge.textContent = d.accountLocked ? "● Account Locked" : "● Account Active";

            document.getElementById("drawerHasPin").textContent = d.hasSecurityPin ? "Configured & Active" : "Not Set";
            document.getElementById("drawerFailedPin").textContent = `${d.failedPinAttempts || 0} / 5 attempts`;

            document.getElementById("drawerExpenseCount").textContent = (d.expenseCount || 0).toLocaleString();
            document.getElementById("drawerExpenseSum").textContent = formatCurrency(d.totalExpenseSum || 0);
            document.getElementById("drawerIncomeCount").textContent = (d.incomeCount || 0).toLocaleString();
            document.getElementById("drawerIncomeSum").textContent = formatCurrency(d.totalIncomeSum || 0);

            const toggleLockBtn = document.getElementById("drawerToggleLockBtn");
            toggleLockBtn.textContent = d.accountLocked ? "Unlock Account" : "Lock Account";
            toggleLockBtn.className = d.accountLocked ? "btn-primary" : "btn-danger";

            const roleSelect = document.getElementById("drawerRoleSelect");
            if (roleSelect) roleSelect.value = d.role;

            drawer.classList.add("open");
            overlay.classList.add("open");
            overlay.classList.add("active");

            setTimeout(() => {
                if (typeof window.initAllCustomSelects === "function") window.initAllCustomSelects();
            }, 30);

            // Fetch this user specific real-time transactions into drawer table
            loadUserDrawerLedger(userId, "expenses");
        } catch (e) {
            console.error("Open drawer error:", e);
            showToast("Failed to fetch user security details", "error");
        }
    }

    let drawerTxnType = "expenses";
    async function loadUserDrawerLedger(userId, type) {
        drawerTxnType = type;
        const tbody = document.getElementById("drawerLedgerTableBody");
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:16px; color:var(--text-muted);">Loading transactions…</td></tr>`;

        document.getElementById("drawerTabExpensesBtn")?.classList.toggle("active", type === "expenses");
        document.getElementById("drawerTabIncomesBtn")?.classList.toggle("active", type === "incomes");

        try {
            const endpoint = type === "incomes" ? `/admin/data/incomes?userId=${userId}&size=25` : `/admin/data/expenses?userId=${userId}&size=25`;
            const data = await apiRequest(endpoint);
            const items = Array.isArray(data) ? data : (data?.content || []);

            if (items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:16px; color:var(--text-muted);">No records found for this user.</td></tr>`;
                return;
            }

            tbody.innerHTML = "";
            items.forEach(it => {
                const tr = document.createElement("tr");
                const dateStr = it.date || it.expenseDate || it.incomeDate || "—";
                const dClean = dateStr !== "—" ? new Date(dateStr).toLocaleDateString() : "—";
                const cat = escapeHtml(it.categoryName || it.category || it.source || "General");
                const amt = formatCurrency(it.amount || 0);
                const desc = escapeHtml(it.description || it.note || "—");

                tr.innerHTML = `
                    <td style="color:var(--text-muted);">${dClean}</td>
                    <td><span class="status-badge badge-netflow">${cat}</span></td>
                    <td style="font-family:var(--font-mono); font-weight:700; color:${type === 'incomes' ? 'var(--metric-inflow)' : 'var(--metric-outflow)'};">
                        ${type === 'incomes' ? '+' : '-'}${amt}
                    </td>
                    <td style="color:var(--text-main); max-width:140px; overflow:hidden; text-overflow:ellipsis;">${desc}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:16px; color:var(--danger-text);">Error loading transactions</td></tr>`;
        }
    }

    // ── Platform Database Multi-Tenant Ledger Inspection ─────────────────────
    let dbPage = 0;
    const dbPageSize = 25;
    let dbStreamType = "expenses";
    let dbSelectedUserId = "";

    function populateDbUserFilter(users) {
        const sel = document.getElementById("dbUserFilterSelect");
        if (!sel || !Array.isArray(users)) return;
        const currentVal = sel.value;
        sel.innerHTML = `<option value="">All Platform Users</option>`;
        users.forEach(u => {
            const opt = document.createElement("option");
            opt.value = u.id;
            opt.textContent = `User #${u.id} - ${u.name || u.username} (${u.email})`;
            sel.appendChild(opt);
        });
        sel.value = currentVal;
    }

    async function loadPlatformDatabase() {
        const tbody = document.getElementById("databaseTableBody");
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">Querying platform database…</td></tr>`;

        try {
            let endpoint = dbStreamType === "incomes" ? "/admin/data/incomes" : "/admin/data/expenses";
            let url = `${endpoint}?page=${dbPage}&size=${dbPageSize}`;
            if (dbSelectedUserId) {
                url += `&userId=${encodeURIComponent(dbSelectedUserId)}`;
            }

            const data = await apiRequest(url);
            const items = Array.isArray(data) ? data : (data?.content || []);

            if (items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">No records found in this stream.</td></tr>`;
                document.getElementById("dbPaginationLabel").textContent = `Showing page ${dbPage + 1}`;
                document.getElementById("dbPrevBtn").disabled = dbPage === 0;
                document.getElementById("dbNextBtn").disabled = true;
                return;
            }

            tbody.innerHTML = "";
            items.forEach(item => {
                const tr = document.createElement("tr");
                const isExpense = dbStreamType === "expenses";
                const amountFormatted = formatCurrency(item.amount || 0);
                const dateStr = item.date || item.expenseDate || item.incomeDate || item.createdAt || "—";
                const dateClean = dateStr !== "—" ? new Date(dateStr).toLocaleDateString() : "—";
                const categoryOrSource = escapeHtml(item.categoryName || item.category || item.source || "General");
                const desc = escapeHtml(item.description || item.note || "—");
                const method = escapeHtml(item.paymentMethod || item.incomeType || (item.recurring ? "Subscription" : "One-off"));
                const userDisplay = item.userId ? `#${item.userId} (${escapeHtml(item.userName || item.username || item.userEmail || "User")})` : "System";

                tr.innerHTML = `
                    <td style="font-family:var(--font-mono); color:var(--text-muted);">#${escapeHtml(item.id)}</td>
                    <td style="font-size:12px; font-weight:600; color:var(--text-main);">${userDisplay}</td>
                    <td style="color:var(--text-muted); font-size:12px;">${dateClean}</td>
                    <td><span class="status-badge badge-netflow">${categoryOrSource}</span></td>
                    <td style="font-family:var(--font-mono); font-weight:700; color:${isExpense ? 'var(--metric-outflow)' : 'var(--metric-inflow)'};">
                        ${isExpense ? '-' : '+'}${amountFormatted}
                    </td>
                    <td style="color:var(--text-main); max-width:240px; overflow:hidden; text-overflow:ellipsis;">${desc}</td>
                    <td><span style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">${method}</span></td>
                `;
                tbody.appendChild(tr);
            });

            document.getElementById("dbPaginationLabel").textContent = `Showing page ${dbPage + 1} (${items.length} records)`;
            document.getElementById("dbPrevBtn").disabled = dbPage === 0;
            const totalPages = data?.totalPages !== undefined ? data.totalPages : (items.length < dbPageSize ? dbPage + 1 : dbPage + 2);
            document.getElementById("dbNextBtn").disabled = (dbPage + 1) >= totalPages;
        } catch (e) {
            console.error("Database load error:", e);
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--danger-text);">Failed to load platform database: ${escapeHtml(e.message)}</td></tr>`;
        }
    }

    function closeUserDrawer() {
        document.getElementById("userDrawer")?.classList.remove("open");
        const overlay = document.getElementById("drawerOverlay");
        if (overlay) {
            overlay.classList.remove("open");
            overlay.classList.remove("active");
        }
        selectedDrawerUserId = null;
    }

    // ── User Edit Modal Logic ────────────────────────────────────────────────
    async function openEditUserModal(userId) {
        try {
            const d = await apiRequest(`/admin/users/${userId}/details`);
            if (!d) return;

            document.getElementById("editUserId").value = d.id;
            document.getElementById("editUserSubtitle").textContent = `Updating record for #${d.id} (${d.username || "—"})`;
            document.getElementById("editUserName").value = d.name || "";
            document.getElementById("editUserUsername").value = d.username || "";
            document.getElementById("editUserEmail").value = d.email || "";
            document.getElementById("editUserRole").value = d.role;
            document.getElementById("editUserStatus").value = d.accountLocked ? "LOCKED" : "ACTIVE";
            document.getElementById("editUserPassword").value = "";
            document.getElementById("editUserPin").value = "";
            document.getElementById("editUserAdminPin").value = "";

            const modal = document.getElementById("editUserModal");
            modal.classList.add("active");
            modal.classList.add("open");

            setTimeout(() => {
                if (typeof window.initAllCustomSelects === "function") window.initAllCustomSelects();
                document.getElementById("editUserName")?.focus();
            }, 50);
        } catch (e) {
            showToast("Failed to fetch user details for editing: " + e.message, "error");
        }
    }

    function closeEditUserModal() {
        const modal = document.getElementById("editUserModal");
        if (modal) {
            modal.classList.remove("active");
            modal.classList.remove("open");
        }
        document.getElementById("editUserForm")?.reset();
    }

    // ── User Deletion Confirmation with Step-Up PIN ──────────────────────────
    function confirmDeleteUser(userId, userName) {
        if (permissions && permissions.username && userName === permissions.username) {
            showToast("Self-deletion of your active administrator account is prohibited", "error");
            return;
        }

        triggerStepUpVerification({
            title: `Permanently Delete User #${userId}`,
            desc: `Are you sure you want to permanently delete user "${userName}"? This purges all transactions, tokens, and records. Action cannot be undone. Requires 6-digit Security PIN.`,
            onConfirm: async (pin) => {
                const res = await apiRequest(`/admin/users/${userId}`, {
                    method: "DELETE",
                    headers: { "X-Step-Up-Pin": pin }
                });
                showToast(res.message || `User #${userId} deleted`, "success");
                loadUsersDirectory();
                loadMissionControl();
            }
        });
    }

    // ── 3-Tier Multi-Cloud Database Topology ─────────────────────────────────
    async function loadDatabaseTopology(isManualProbe = false) {
        const sStatusEl = document.getElementById("dbServerStatus");
        const nStatusEl = document.getElementById("dbNeonStatus");
        const hStatusEl = document.getElementById("dbHfStatus");

        if (isManualProbe) {
            if (sStatusEl) { sStatusEl.className = "status-badge badge-warning"; sStatusEl.innerHTML = '<span class="pulse-dot" style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block;margin-right:4px;"></span>PROBING...'; }
            if (nStatusEl) { nStatusEl.className = "status-badge badge-warning"; nStatusEl.innerHTML = '<span class="pulse-dot" style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block;margin-right:4px;"></span>PROBING...'; }
            if (hStatusEl) { hStatusEl.className = "status-badge badge-warning"; hStatusEl.innerHTML = '<span class="pulse-dot" style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block;margin-right:4px;"></span>PROBING...'; }
            const lat1 = document.getElementById("dbServerLatency");
            const lat2 = document.getElementById("dbNeonLatency");
            const lat3 = document.getElementById("dbHfLatency");
            if (lat1) lat1.textContent = "Pinging…";
            if (lat2) lat2.textContent = "Pinging…";
            if (lat3) lat3.textContent = "Pinging…";
        }

        try {
            const data = await apiRequest("/admin/resilience/database-state");
            if (!data) throw new Error("No database state returned by server");

            // Server Primary Engine
            const s = data.server || data.serverDatabase;
            if (s) {
                if (sStatusEl) {
                    const status = (s.healthStatus || s.status || "ONLINE").toUpperCase();
                    sStatusEl.textContent = status.includes("ONLINE") ? "ONLINE" : (status.includes("DEGRADED") ? "DEGRADED" : status);
                    sStatusEl.className = status.includes("ONLINE") ? "status-badge badge-success" : (status.includes("DEGRADED") ? "status-badge badge-warning" : "status-badge badge-netflow");
                }
                const vendorEl = document.getElementById("dbServerVendor");
                if (vendorEl) vendorEl.textContent = s.engine || s.vendor || "PostgreSQL";
                const latEl = document.getElementById("dbServerLatency");
                if (latEl) latEl.textContent = `${s.latencyMs ?? 1} ms`;
                const connEl = document.getElementById("dbServerConns");
                if (connEl) connEl.textContent = `${s.activeConnections ?? 1} / ${s.maxConnections ?? 10} pool`;
                const catEl = document.getElementById("dbServerCatalog");
                if (catEl) catEl.textContent = s.databaseName || s.catalog || "expensetracker";
                const noteEl = document.getElementById("dbServerNotes");
                if (noteEl) noteEl.textContent = s.routingMode ? `Routing Mode: ${s.routingMode}` : (s.notes || "Primary high-throughput transactional engine");
            }

            // Neon Serverless PostgreSQL
            const n = data.neon || data.neonCloudDatabase;
            if (n) {
                if (nStatusEl) {
                    const status = (n.status || "STANDBY").toUpperCase();
                    nStatusEl.textContent = status.includes("ONLINE") ? "ONLINE" : "STANDBY";
                    nStatusEl.className = status.includes("ONLINE") ? "status-badge badge-success" : "status-badge badge-netflow";
                }
                const vendorEl = document.getElementById("dbNeonVendor");
                if (vendorEl) vendorEl.textContent = n.host ? `Serverless (${n.host.split('.')[0]})` : (n.vendor || "Serverless Neon PG");
                const latEl = document.getElementById("dbNeonLatency");
                if (latEl) latEl.textContent = `${n.latencyMs ?? 28} ms`;
                const connEl = document.getElementById("dbNeonConns");
                if (connEl) connEl.textContent = `${n.activeConnections ?? 1} / ${n.maxPoolSize ?? n.maxConnections ?? 10} active`;
                const catEl = document.getElementById("dbNeonCatalog");
                if (catEl) catEl.textContent = n.host || n.databaseName || "neon-expensetracker";
                const noteEl = document.getElementById("dbNeonNotes");
                if (noteEl) noteEl.textContent = n.lastProbeStatus ? `${n.lastProbeStatus} • SSL: ${n.sslMode || 'require'}` : (n.notes || "Cloud serverless tier configured for multi-zone durability");
            }

            // Hugging Face Spaces Failover
            const h = data.huggingFace || data.huggingFaceSpaces;
            if (h) {
                if (hStatusEl) {
                    const status = (h.status || (h.isConfigured ? "ONLINE" : "STANDBY")).toUpperCase();
                    hStatusEl.textContent = status.includes("ONLINE") ? "ONLINE" : "STANDBY";
                    hStatusEl.className = status.includes("ONLINE") ? "status-badge badge-success" : "status-badge badge-subs";
                }
                const vendorEl = document.getElementById("dbHfVendor");
                if (vendorEl) vendorEl.textContent = h.cipherAlgorithm ? `Git LFS + ${h.cipherAlgorithm}` : (h.vendor || "Git LFS + SQLite Cipher");
                const latEl = document.getElementById("dbHfLatency");
                if (latEl) latEl.textContent = `${h.latencyMs ?? 45} ms`;
                const connEl = document.getElementById("dbHfConns");
                if (connEl) connEl.textContent = (h.status?.toUpperCase().includes("ONLINE") || h.isConfigured) ? "Ready & Synced" : "Standby";
                const catEl = document.getElementById("dbHfCatalog");
                if (catEl) catEl.textContent = h.spaceName || h.databaseName || "Yoge-2004/expense-tracker-backend";
                const noteEl = document.getElementById("dbHfNotes");
                if (noteEl) noteEl.textContent = h.tokenScopeDiagnosis ? `${h.tokenScopeDiagnosis}` : (h.notes || "Secondary failover replica with AES-256-GCM snapshot sync");
            }

            if (isManualProbe) {
                document.querySelectorAll("#databaseTopologyGrid .card").forEach(c => {
                    c.style.transition = "box-shadow 0.35s ease, transform 0.2s ease";
                    c.style.boxShadow = "0 0 16px rgba(199, 154, 62, 0.45)";
                    setTimeout(() => { c.style.boxShadow = ""; }, 1000);
                });
            }

            return data;
        } catch (e) {
            console.error("Database topology query error:", e);
            if (isManualProbe) {
                if (sStatusEl) { sStatusEl.className = "status-badge badge-warning"; sStatusEl.textContent = "UNREACHABLE"; }
                if (nStatusEl) { nStatusEl.className = "status-badge badge-warning"; nStatusEl.textContent = "STANDBY"; }
                if (hStatusEl) { hStatusEl.className = "status-badge badge-warning"; hStatusEl.textContent = "STANDBY"; }
                throw e;
            }
        }
    }

    // ── ML Governance & Feedback Queue ───────────────────────────────────────
    async function loadMlStats() {
        try {
            const stats = await apiRequest("/admin/ml/stats");
            if (!stats) return;

            document.getElementById("mlActiveModel").textContent = stats.activeModel || "TFIDF-v2.4";
            document.getElementById("mlPendingFeedback").textContent = `${stats.pendingFeedback || 0} Pending Review`;
            document.getElementById("mlTotalFeedback").textContent = (stats.totalFeedback || 0).toLocaleString();
        } catch (e) {
            console.error("ML stats error:", e);
        }
    }

    async function loadMlFeedbackQueue() {
        const queueList = document.getElementById("feedbackQueueList");
        if (!queueList) return;

        try {
            const raw = await apiRequest("/admin/ml/feedback/pending");
            const data = Array.isArray(raw) ? raw : (raw?.content || []);
            if (data.length === 0) {
                queueList.innerHTML = `<div style="padding:24px; text-align:center; color:var(--text-muted);">All feedback items reviewed. Queue clear!</div>`;
                return;
            }

            queueList.innerHTML = "";
            data.forEach(item => {
                const card = document.createElement("div");
                card.className = "card";
                card.style.background = "var(--input-bg)";
                card.style.border = "1px solid var(--border)";
                card.style.padding = "14px";
                card.style.borderRadius = "12px";

                const desc = escapeHtml(item.text || item.expenseDescription || "Category feedback");
                const predicted = escapeHtml(item.predictedCategory || item.suggestedCategory || "—");
                const corrected = escapeHtml(item.correctedCategory || item.userSelectedCategory || "—");
                const user = escapeHtml(item.userEmail ? `by ${item.userEmail}` : "");

                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <strong style="color:var(--text-main); font-size:13px;">"${desc}"</strong>
                        <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">${user}</span>
                    </div>
                    <div style="font-size:12px; margin-bottom:12px; display:flex; gap:10px; align-items:center;">
                        <span style="color:var(--danger-text); text-decoration:line-through;">Model: ${predicted}</span>
                        <span style="color:var(--text-muted);">➔</span>
                        <span style="color:var(--metric-inflow); font-weight:700;">User: ${corrected}</span>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-primary" style="flex:1; padding:6px 10px; font-size:11px;" onclick="reviewMlFeedback(${item.id}, 'ACCEPT')">
                            Accept Correction
                        </button>
                        <button class="btn-secondary" style="flex:1; padding:6px 10px; font-size:11px;" onclick="reviewMlFeedback(${item.id}, 'REJECT')">
                            Reject
                        </button>
                    </div>
                `;
                queueList.appendChild(card);
            });
        } catch (e) {
            console.error("ML queue error:", e);
        }
    }

    window.reviewMlFeedback = async function (id, decision) {
        try {
            await apiRequest(`/admin/ml/feedback/${id}/review`, {
                method: "POST",
                body: JSON.stringify({ decision })
            });
            showToast(`Correction marked as ${decision}`, "success");
            loadMlStats();
            loadMlFeedbackQueue();
        } catch (e) {
            showToast(e.message || "Failed to submit review", "error");
        }
    };

    // ── Live Broadcast Mockup ────────────────────────────────────────────────
    function setupInteractiveMockup() {
        const titleInput = document.getElementById("broadcastTitle");
        const bodyInput = document.getElementById("broadcastBody");
        const previewTitle = document.getElementById("previewTitle");
        const previewBody = document.getElementById("previewBody");
        const clock = document.getElementById("phoneMockupClock");

        if (clock) {
            const now = new Date();
            clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        if (titleInput && previewTitle) {
            titleInput.addEventListener("input", () => {
                previewTitle.textContent = titleInput.value.trim() || "System Notice Headline";
            });
        }

        if (bodyInput && previewBody) {
            bodyInput.addEventListener("input", () => {
                previewBody.textContent = bodyInput.value.trim() || "Announcement message text will update in real time as you compose.";
            });
        }
    }

    // ── Application Logs & Observability ─────────────────────────────
    let cachedLogs = [];
    let logSearchDebounceTimer = null;

    async function loadApplicationLogs() {
        const viewport = document.getElementById("logsTerminalViewport");
        const countEl = document.getElementById("logEntriesCount");
        const level = document.getElementById("logLevelSelect")?.value || "ALL";
        const lines = document.getElementById("logLinesSelect")?.value || "150";
        const query = document.getElementById("logFilterSearch")?.value?.trim() || "";

        try {
            let url = `/admin/system/logs?lines=${encodeURIComponent(lines)}`;
            if (level && level !== "ALL") url += `&level=${encodeURIComponent(level)}`;
            if (query) url += `&query=${encodeURIComponent(query)}`;

            const logs = await apiRequest(url);
            if (!Array.isArray(logs)) return;
            cachedLogs = logs;

            if (countEl) countEl.textContent = `${logs.length} events`;
            if (!viewport) return;

            if (logs.length === 0) {
                viewport.innerHTML = `<div style="color:var(--text-muted); padding:24px; text-align:center;">No matching log events recorded in buffer.</div>`;
                return;
            }

            const html = logs.map(entry => {
                const ts = entry.timestamp ? entry.timestamp.replace("T", " ").replace("Z", "") : "";
                const lvl = (entry.level || "INFO").toUpperCase();
                const thread = entry.threadName ? `[${escapeHtml(entry.threadName)}]` : "";
                const logger = entry.loggerName ? escapeHtml(entry.loggerName) : "";
                const msg = escapeHtml(entry.message || "");

                return `<div class="log-line log-${lvl.toLowerCase()}">` +
                    `<span class="log-ts">${escapeHtml(ts)}</span>` +
                    `<span class="log-badge ${lvl}">${lvl}</span>` +
                    (thread ? `<span class="log-thread">${thread}</span>` : "") +
                    (logger ? `<span class="log-logger">${logger}:</span>` : "") +
                    `<span class="log-msg log-msg-${lvl.toLowerCase()}">${msg}</span>` +
                `</div>`;
            }).join("");

            viewport.innerHTML = html;

            const autoScroll = document.getElementById("logAutoScrollCheck")?.checked;
            if (autoScroll) {
                viewport.scrollTop = viewport.scrollHeight;
            }
        } catch (err) {
            console.error("Failed to load application logs:", err);
            if (viewport) {
                viewport.innerHTML = `<div style="color:var(--danger-text); padding:24px; text-align:center;">Failed to retrieve logs: ${escapeHtml(err.message || "Unknown error")}</div>`;
            }
        }
    }

    // ── Resilience & Storage Diagnostics ─────────────────────────────────────
    async function loadResilienceDiagnostics() {
        const box = document.getElementById("resilienceConsoleOutput");
        const badge = document.getElementById("hfStatusBadge");
        const spaceSub = document.getElementById("hfSpaceNameSub");

        try {
            const diag = await apiRequest("/admin/resilience/status");
            if (!diag) return;

            badge.textContent = diag.configured ? "ONLINE & SYNCHRONIZED" : "NOT CONFIGURED";
            badge.style.color = diag.configured ? "var(--metric-inflow)" : "var(--metric-outflow)";
            spaceSub.textContent = `Space: ${diag.space || "Not Configured"}`;
            box.textContent = JSON.stringify(diag, null, 2);
        } catch (e) {
            box.textContent = "Error inspecting resilience telemetry: " + e.message;
        }
    }

    // ── Compliance Audit Trail ───────────────────────────────────────────────
    async function loadAuditLogs() {
        const query = document.getElementById("auditLogSearch")?.value?.trim() || "";
        const tbody = document.getElementById("auditTableBody");
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">Streaming audit trail…</td></tr>`;

        try {
            let url = `/admin/audit-logs?page=${auditPage}&size=${auditPageSize}`;
            if (query) url += `&query=${encodeURIComponent(query)}`;

            const data = await apiRequest(url);
            if (!data || !Array.isArray(data.content) || data.content.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">No audit records found matching parameters.</td></tr>`;
                return;
            }

            tbody.innerHTML = "";
            data.content.forEach(log => {
                const tr = document.createElement("tr");
                const dateStr = log.createdAt ? new Date(log.createdAt).toLocaleString() : "—";

                tr.innerHTML = `
                    <td style="color:var(--text-muted); font-size:12px; font-family:var(--font-mono); white-space:nowrap;">${dateStr}</td>
                    <td><strong style="color:var(--primary);">${escapeHtml(log.actorUsername)}</strong></td>
                    <td><span class="status-badge badge-netflow">${escapeHtml(log.action)}</span></td>
                    <td style="color:var(--text-muted);">${escapeHtml(log.targetResource)}</td>
                    <td style="font-family:var(--font-mono); color:var(--text-muted);">${escapeHtml(log.targetId || "—")}</td>
                    <td style="font-family:var(--font-mono); color:var(--text-muted); font-size:12px;">${escapeHtml(log.ipAddress || "—")}</td>
                    <td style="font-size:12px; color:var(--text-main); max-width:320px; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(log.details || "—")}</td>
                `;

                tbody.appendChild(tr);
            });

            const totalPages = data.totalPages || 1;
            document.getElementById("auditPaginationLabel").textContent =
                `Page ${auditPage + 1} of ${totalPages} (${data.totalElements || 0} events logged)`;
            document.getElementById("auditPrevBtn").disabled = auditPage <= 0;
            document.getElementById("auditNextBtn").disabled = auditPage >= totalPages - 1;

        } catch (e) {
            console.error("Audit trail load error:", e);
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--accent-text);">Failed to load audit logs.</td></tr>`;
        }
    }

    // ── Global Event Listeners & Step-Up Handler ─────────────────────────────
    function setupEventListeners() {
        // Operator Profile Menu Toggle
        const adminProfileTrigger = document.getElementById("adminProfileTrigger");
        const adminProfileMenu = document.getElementById("adminProfileMenu");
        const closeAdminProfileMenuBtn = document.getElementById("closeAdminProfileMenuBtn");

        function toggleAdminProfileMenu(open) {
            if (!adminProfileTrigger || !adminProfileMenu) return;
            const isOpen = open !== undefined ? open : !adminProfileMenu.classList.contains("active");
            adminProfileMenu.classList.toggle("active", isOpen);
            adminProfileTrigger.classList.toggle("active", isOpen);
            adminProfileTrigger.setAttribute("aria-expanded", String(isOpen));
        }

        adminProfileTrigger?.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleAdminProfileMenu();
        });

        closeAdminProfileMenuBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleAdminProfileMenu(false);
        });

        document.addEventListener("click", (e) => {
            if (adminProfileTrigger && adminProfileMenu && !adminProfileTrigger.contains(e.target) && !adminProfileMenu.contains(e.target)) {
                toggleAdminProfileMenu(false);
            }
        });

        // Logout
        document.getElementById("sidebarLogoutBtn")?.addEventListener("click", () => {
            if (confirm("Sign out of the Admin Command Center?")) {
                localStorage.removeItem("token");
                localStorage.removeItem("userId");
                localStorage.removeItem("userRole");
                window.location.replace("index.html");
            }
        });

        // Cache purge
        document.getElementById("quickPurgeCacheBtn")?.addEventListener("click", async () => {
            try {
                await apiRequest("/admin/metrics/purge-cache", { method: "POST" });
                showToast("In-memory metrics cache cleared!", "success");
                loadMissionControl();
            } catch (e) {
                showToast("Failed to purge cache: " + e.message, "error");
            }
        });

        // User Directory Search & Filters
        document.getElementById("userDirectorySearch")?.addEventListener("input", () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                userPage = 0;
                loadUsersDirectory();
            }, 300);
        });

        document.getElementById("userRoleFilterSelect")?.addEventListener("change", () => {
            userPage = 0;
            loadUsersDirectory();
        });

        document.getElementById("refreshUserTableBtn")?.addEventListener("click", () => loadUsersDirectory());

        document.getElementById("userPrevBtn")?.addEventListener("click", () => {
            if (userPage > 0) {
                userPage--;
                loadUsersDirectory();
            }
        });

        document.getElementById("userNextBtn")?.addEventListener("click", () => {
            userPage++;
            loadUsersDirectory();
        });

        // Drawer Close Handlers
        document.getElementById("closeDrawerBtn")?.addEventListener("click", closeUserDrawer);
        document.getElementById("drawerOverlay")?.addEventListener("click", closeUserDrawer);

        // Account Lock / Unlock Toggle
        document.getElementById("drawerToggleLockBtn")?.addEventListener("click", () => {
            if (!selectedDrawerUserId) return;
            const currentLocked = document.getElementById("drawerStatusBadge").textContent.includes("Locked");
            const newLockedState = !currentLocked;

            triggerStepUpVerification({
                title: newLockedState ? "Confirm Account Lockdown" : "Confirm Account Reactivation",
                desc: `Are you sure you want to ${newLockedState ? "suspend and lockout" : "reinstate access for"} this user? Requires 6-digit PIN.`,
                onConfirm: async (pin) => {
                    await apiRequest(`/admin/users/${selectedDrawerUserId}/status`, {
                        method: "PUT",
                        body: JSON.stringify({
                            accountLocked: newLockedState,
                            reason: newLockedState ? "Administrative security enforcement" : "Reinstatement by admin",
                            stepUpPin: pin
                        })
                    });
                    showToast(`Account successfully ${newLockedState ? "locked" : "reinstated"}`, "success");
                    openUserDrawer(selectedDrawerUserId);
                    loadUsersDirectory();
                    loadMissionControl();
                }
            });
        });

        // PIN Lockout Reset
        document.getElementById("drawerResetPinLockoutBtn")?.addEventListener("click", async () => {
            if (!selectedDrawerUserId) return;
            try {
                await apiRequest(`/admin/users/${selectedDrawerUserId}/reset-pin-lockout`, {
                    method: "POST"
                });
                showToast("User PIN lockout attempts reset to 0!", "success");
                openUserDrawer(selectedDrawerUserId);
            } catch (e) {
                showToast(e.message || "Failed to reset PIN lockout", "error");
            }
        });

        // Role Promotion
        document.getElementById("drawerApplyRoleBtn")?.addEventListener("click", () => {
            if (!selectedDrawerUserId) return;
            const selectedRole = document.getElementById("drawerRoleSelect")?.value;

            triggerStepUpVerification({
                title: `Elevate User Privilege Tier to ${selectedRole}`,
                desc: "Altering administrative authorities is an audited operation requiring Super Admin PIN verification.",
                onConfirm: async (pin) => {
                    await apiRequest(`/admin/users/${selectedDrawerUserId}/role`, {
                        method: "PUT",
                        body: JSON.stringify({
                            role: selectedRole,
                            stepUpPin: pin
                        })
                    });
                    showToast(`User role elevated to ${selectedRole}`, "success");
                    openUserDrawer(selectedDrawerUserId);
                    loadUsersDirectory();
                }
            });
        });

        // Invalidate JWT Sessions
        document.getElementById("drawerRevokeSessionsBtn")?.addEventListener("click", async () => {
            if (!selectedDrawerUserId) return;
            try {
                await apiRequest(`/admin/users/${selectedDrawerUserId}/revoke-sessions`, {
                    method: "POST"
                });
                showToast("Active user sessions successfully revoked!", "success");
            } catch (e) {
                showToast("Failed to revoke sessions: " + e.message, "error");
            }
        });

        // Delete User Account from Drawer
        document.getElementById("drawerDeleteUserBtn")?.addEventListener("click", () => {
            if (!selectedDrawerUserId) return;
            const userName = document.getElementById("drawerName")?.textContent || `User #${selectedDrawerUserId}`;
            closeUserDrawer();
            confirmDeleteUser(selectedDrawerUserId, userName);
        });

        // Provision User Modal Handlers
        const createUserModal = document.getElementById("createUserModal");
        const openCreateUserModalBtn = document.getElementById("openCreateUserModalBtn");
        const closeCreateUserModalBtn = document.getElementById("closeCreateUserModalBtn");
        const cancelCreateUserBtn = document.getElementById("cancelCreateUserBtn");
        const createUserForm = document.getElementById("createUserForm");

        function openCreateUserModal() {
            createUserForm.reset();
            createUserModal.classList.add("active");
            createUserModal.classList.add("open");
            setTimeout(() => {
                if (typeof window.initAllCustomSelects === "function") window.initAllCustomSelects();
                document.getElementById("createUserName")?.focus();
            }, 50);
        }

        function closeCreateUserModal() {
            createUserModal.classList.remove("active");
            createUserModal.classList.remove("open");
            createUserForm.reset();
        }

        openCreateUserModalBtn?.addEventListener("click", openCreateUserModal);
        closeCreateUserModalBtn?.addEventListener("click", closeCreateUserModal);
        cancelCreateUserBtn?.addEventListener("click", closeCreateUserModal);

        createUserForm?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("createUserName")?.value.trim();
            const username = document.getElementById("createUserUsername")?.value.trim();
            const email = document.getElementById("createUserEmail")?.value.trim();
            const password = document.getElementById("createUserPassword")?.value;
            const role = document.getElementById("createUserRole")?.value || "ROLE_USER";
            const accountLocked = document.getElementById("createUserStatus")?.value === "LOCKED";
            const securityPin = document.getElementById("createUserPin")?.value.trim();
            const stepUpPin = document.getElementById("createUserAdminPin")?.value.trim();

            if (!/^\d{6}$/.test(securityPin)) {
                showToast("User Security PIN must be exactly 6 digits", "error");
                document.getElementById("createUserPin")?.focus();
                return;
            }
            if (!/^\d{6}$/.test(stepUpPin)) {
                showToast("Admin Step-Up PIN must be exactly 6 digits", "error");
                document.getElementById("createUserAdminPin")?.focus();
                return;
            }

            const submitBtn = document.getElementById("submitCreateUserBtn");
            submitBtn.disabled = true;
            submitBtn.textContent = "Provisioning…";

            try {
                const res = await apiRequest("/admin/users", {
                    method: "POST",
                    body: JSON.stringify({
                        name,
                        username,
                        email,
                        password,
                        role,
                        accountLocked,
                        securityPin,
                        stepUpPin
                    })
                });

                showToast(`User ${res.username || username} successfully provisioned!`, "success");
                closeCreateUserModal();
                loadUsersDirectory();
                loadMissionControl();
            } catch (err) {
                showToast(err.message || "Failed to provision user", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Provision User";
            }
        });

        // Edit User Modal Handlers
        const closeEditUserModalBtn = document.getElementById("closeEditUserModalBtn");
        const cancelEditUserBtn = document.getElementById("cancelEditUserBtn");
        const editUserForm = document.getElementById("editUserForm");

        closeEditUserModalBtn?.addEventListener("click", closeEditUserModal);
        cancelEditUserBtn?.addEventListener("click", closeEditUserModal);

        editUserForm?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const userId = document.getElementById("editUserId")?.value;
            const name = document.getElementById("editUserName")?.value.trim();
            const email = document.getElementById("editUserEmail")?.value.trim();
            const role = document.getElementById("editUserRole")?.value || "ROLE_USER";
            const accountLocked = document.getElementById("editUserStatus")?.value === "LOCKED";
            const newPassword = document.getElementById("editUserPassword")?.value.trim() || null;
            const newSecurityPin = document.getElementById("editUserPin")?.value.trim() || null;
            const stepUpPin = document.getElementById("editUserAdminPin")?.value.trim();

            if (newSecurityPin && !/^\d{6}$/.test(newSecurityPin)) {
                showToast("Reset PIN must be exactly 6 digits", "error");
                document.getElementById("editUserPin")?.focus();
                return;
            }
            if (!/^\d{6}$/.test(stepUpPin)) {
                showToast("Admin Step-Up PIN must be exactly 6 digits", "error");
                document.getElementById("editUserAdminPin")?.focus();
                return;
            }

            const submitBtn = document.getElementById("submitEditUserBtn");
            submitBtn.disabled = true;
            submitBtn.textContent = "Saving…";

            try {
                const res = await apiRequest(`/admin/users/${userId}`, {
                    method: "PUT",
                    body: JSON.stringify({
                        name,
                        email,
                        role,
                        accountLocked,
                        newPassword,
                        newSecurityPin,
                        stepUpPin
                    })
                });

                showToast(`User ${res.username || userId} successfully updated!`, "success");
                closeEditUserModal();
                loadUsersDirectory();
                loadMissionControl();
            } catch (err) {
                showToast(err.message || "Failed to update user", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Save Changes";
            }
        });

        // 3-Tier Database Cluster Probe
        document.getElementById("btnProbeTopology")?.addEventListener("click", async () => {
            const btn = document.getElementById("btnProbeTopology");
            const svg = btn?.querySelector("svg");
            if (btn) btn.disabled = true;
            if (svg) svg.style.animation = "spin 0.8s linear infinite";

            showToast("Probing multi-cloud cluster latency & storage states…", "info");
            try {
                await loadDatabaseTopology(true);
                await loadResilienceDiagnostics();
                showToast("Database cluster state refreshed in real time!", "success");
            } catch (err) {
                console.error("Cluster probe failed:", err);
                showToast("Failed to probe cluster: " + (err.message || "Request failed"), "error");
            } finally {
                if (btn) btn.disabled = false;
                if (svg) svg.style.animation = "";
            }
        });

        // ML Sandbox Test Inference
        document.getElementById("runSandboxInferenceBtn")?.addEventListener("click", async () => {
            const input = document.getElementById("sandboxTextInput")?.value?.trim();
            if (!input) {
                showToast("Please enter an expense description to test", "warning");
                return;
            }

            try {
                const res = await apiRequest("/admin/ml/sandbox/predict", {
                    method: "POST",
                    body: JSON.stringify({ text: input })
                });

                if (res) {
                    const stage = document.getElementById("sandboxOutputStage");
                    stage.style.display = "block";
                    document.getElementById("sandboxTopCategory").textContent = res.predictedCategory || "General";
                    document.getElementById("sandboxTopScore").textContent = `${Math.round((res.confidence || 0) * 100)}% confidence`;

                    const barsStage = document.getElementById("sandboxCandidateBars");
                    barsStage.innerHTML = "";

                    if (Array.isArray(res.candidates)) {
                        res.candidates.slice(0, 4).forEach(cand => {
                            const pct = Math.round((cand.score || 0) * 100);
                            const wrap = document.createElement("div");
                            wrap.className = "sandbox-cand-row";
                            wrap.innerHTML = `
                                <div class="sandbox-cand-meta">
                                    <span>${escapeHtml(cand.category)}</span>
                                    <span>${pct}%</span>
                                </div>
                                <div class="sandbox-bar-track">
                                    <div class="sandbox-bar-fill" style="width:${pct}%;"></div>
                                </div>
                            `;
                            barsStage.appendChild(wrap);
                        });
                    }
                }
            } catch (e) {
                showToast(e.message || "Inference failed", "error");
            }
        });

        // Broadcast Announcement Dispatch
        document.getElementById("sendBroadcastBtn")?.addEventListener("click", () => {
            const title = document.getElementById("broadcastTitle")?.value?.trim();
            const body = document.getElementById("broadcastBody")?.value?.trim();
            const audience = document.getElementById("broadcastAudience")?.value;
            const pin = document.getElementById("broadcastPin")?.value?.trim();

            if (!title || !body) {
                showToast("Headline and message body are required", "error");
                return;
            }
            if (!/^\d{6}$/.test(pin)) {
                showToast("Please enter your valid 6-digit Security PIN", "error");
                document.getElementById("broadcastPin")?.focus();
                return;
            }

            const sendBtn = document.getElementById("sendBroadcastBtn");
            sendBtn.disabled = true;
            sendBtn.textContent = "Broadcasting…";

            apiRequest("/admin/notifications/broadcast", {
                method: "POST",
                body: JSON.stringify({
                    title,
                    message: body,
                    targetAudience: audience,
                    route: "/dashboard",
                    stepUpPin: pin
                })
            }).then(res => {
                showToast(`Broadcast dispatched! Reached ${res.successCount} users.`, "success");
                document.getElementById("broadcastTitle").value = "";
                document.getElementById("broadcastBody").value = "";
                document.getElementById("broadcastPin").value = "";
                document.getElementById("previewTitle").textContent = "System Notice Headline";
                document.getElementById("previewBody").textContent = "Announcement message text will update in real time as you compose.";
            }).catch(e => {
                showToast(e.message || "Broadcast dispatch failed", "error");
            }).finally(() => {
                sendBtn.disabled = false;
                sendBtn.textContent = "Dispatch Broadcast Announcement";
            });
        });

        // Failover Snapshot Trigger
        document.getElementById("triggerFailoverSnapshotBtn")?.addEventListener("click", () => {
            triggerStepUpVerification({
                title: "Confirm Hugging Face Disaster Recovery Push",
                desc: "This procedure encrypts the transactional database and pushes a disaster-recovery snapshot to Hugging Face. Requires Super Admin PIN.",
                onConfirm: async (pin) => {
                    const res = await apiRequest("/admin/resilience/hf-backup", {
                        method: "POST",
                        body: JSON.stringify({ stepUpPin: pin })
                    });
                    showToast(res.message || "Snapshot procedure completed", res.success ? "success" : "error");
                    loadResilienceDiagnostics();
                    loadDatabaseTopology();
                }
            });
        });

        // Platform Database Tab Controls
        document.getElementById("dbStreamTypeSelect")?.addEventListener("change", (e) => {
            dbStreamType = e.target.value;
            dbPage = 0;
            loadPlatformDatabase();
        });

        document.getElementById("dbUserFilterSelect")?.addEventListener("change", (e) => {
            dbSelectedUserId = e.target.value;
            dbPage = 0;
            loadPlatformDatabase();
        });

        document.getElementById("refreshDatabaseBtn")?.addEventListener("click", () => {
            loadPlatformDatabase();
            showToast("Platform database view refreshed", "info");
        });

        document.getElementById("dbPrevBtn")?.addEventListener("click", () => {
            if (dbPage > 0) {
                dbPage--;
                loadPlatformDatabase();
            }
        });

        document.getElementById("dbNextBtn")?.addEventListener("click", () => {
            dbPage++;
            loadPlatformDatabase();
        });

        document.getElementById("exportLedgerJsonBtn")?.addEventListener("click", async () => {
            try {
                showToast("Generating multi-tenant ledger export…", "info");
                const data = await apiRequest("/admin/data/export-ledger");
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = downloadUrl;
                a.download = `platform-ledger-export-${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(downloadUrl);
                showToast("Full platform ledger JSON exported!", "success");
            } catch (err) {
                showToast("Export failed: " + err.message, "error");
            }
        });

        // Drawer Ledger Tab Switchers
        document.getElementById("drawerTabExpensesBtn")?.addEventListener("click", () => {
            if (selectedDrawerUserId) loadUserDrawerLedger(selectedDrawerUserId, "expenses");
        });
        document.getElementById("drawerTabIncomesBtn")?.addEventListener("click", () => {
            if (selectedDrawerUserId) loadUserDrawerLedger(selectedDrawerUserId, "incomes");
        });

        // Audit Log Search & Pagination
        document.getElementById("auditLogSearch")?.addEventListener("input", () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                auditPage = 0;
                loadAuditLogs();
            }, 300);
        });

        document.getElementById("refreshAuditTableBtn")?.addEventListener("click", () => loadAuditLogs());

        document.getElementById("auditPrevBtn")?.addEventListener("click", () => {
            if (auditPage > 0) {
                auditPage--;
                loadAuditLogs();
            }
        });

        document.getElementById("auditNextBtn")?.addEventListener("click", () => {
            auditPage++;
            loadAuditLogs();
        });

        // Audit CSV Export
        document.getElementById("exportAuditCsvBtn")?.addEventListener("click", () => {
            const token = localStorage.getItem("token");
            const url = `${window.API_BASE_URL || "http://localhost:8080/api"}/admin/audit-logs/export`;

            fetch(url, {
                headers: { "Authorization": `Bearer ${token}` }
            })
            .then(res => res.blob())
            .then(blob => {
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = downloadUrl;
                a.download = `compliance-audit-${Date.now()}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(downloadUrl);
                showToast("Audit trail CSV downloaded", "success");
            })
            .catch(e => showToast("Export failed: " + e.message, "error"));
        });

        // Application Logs Controls
        document.getElementById("refreshLogsBtn")?.addEventListener("click", () => {
            loadApplicationLogs();
            showToast("Application logs refreshed", "info");
        });

        document.getElementById("logLevelSelect")?.addEventListener("change", () => loadApplicationLogs());
        document.getElementById("logLinesSelect")?.addEventListener("change", () => loadApplicationLogs());

        document.getElementById("logFilterSearch")?.addEventListener("input", () => {
            clearTimeout(logSearchDebounceTimer);
            logSearchDebounceTimer = setTimeout(() => {
                loadApplicationLogs();
            }, 300);
        });

        document.getElementById("clearLogsViewBtn")?.addEventListener("click", () => {
            const viewport = document.getElementById("logsTerminalViewport");
            if (viewport) {
                viewport.innerHTML = '<div style="color:var(--text-muted); padding:24px; text-align:center;">Console view cleared. Click Refresh to reload stream.</div>';
            }
            const countEl = document.getElementById("logEntriesCount");
            if (countEl) countEl.textContent = "0 events";
            showToast("Log viewport cleared", "info");
        });

        document.getElementById("copyLogsBtn")?.addEventListener("click", async () => {
            if (!cachedLogs || cachedLogs.length === 0) {
                showToast("No log events to copy", "warning");
                return;
            }
            const text = cachedLogs.map(l => `${l.timestamp} [${l.level}] [${l.threadName || "-"}] ${l.loggerName || "-"}: ${l.message}`).join("\n");
            try {
                await navigator.clipboard.writeText(text);
                showToast(`Copied ${cachedLogs.length} log lines to clipboard`, "success");
            } catch (err) {
                showToast("Clipboard copy failed: " + err.message, "error");
            }
        });

        // Server Reconnection Listener (automatic sync after waking up server)
        document.addEventListener("serverreconnected", async () => {
            try {
                await Promise.all([
                    loadMissionControl(),
                    loadTelemetryHud(),
                    loadDatabaseTopology()
                ]);
                const activeTab = document.querySelector(".admin-nav-item.active")?.getAttribute("data-tab");
                if (activeTab === "logsTab") {
                    loadApplicationLogs();
                }
            } catch (e) {
                console.warn("Reconnection reload warning:", e);
            }
        });

        // Step-Up Modal Handlers
        const stepUpModal = document.getElementById("stepUpModal");
        const cancel1 = document.getElementById("stepUpCancelBtn");
        const cancel2 = document.getElementById("stepUpCancelBtn2");
        const confirmBtn = document.getElementById("stepUpConfirmBtn");
        const pinInput = document.getElementById("stepUpModalPinInput");

        function closeStepUp() {
            stepUpModal.classList.remove("open");
            stepUpModal.classList.remove("active");
            pinInput.value = "";
            pendingStepUpAction = null;
        }

        cancel1?.addEventListener("click", closeStepUp);
        cancel2?.addEventListener("click", closeStepUp);

        confirmBtn?.addEventListener("click", async () => {
            const pin = pinInput.value.trim();
            if (!/^\d{6}$/.test(pin)) {
                showToast("Please enter a valid 6-digit numeric PIN", "error");
                pinInput.focus();
                return;
            }

            if (pendingStepUpAction?.onConfirm) {
                confirmBtn.disabled = true;
                confirmBtn.textContent = "Verifying…";
                try {
                    await pendingStepUpAction.onConfirm(pin);
                    closeStepUp();
                } catch (e) {
                    showToast(e.message || "Verification failed", "error");
                } finally {
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = "Verify & Execute";
                }
            }
        });
    }

    function triggerStepUpVerification(opts) {
        pendingStepUpAction = opts;
        document.getElementById("stepUpModalTitle").textContent = opts.title || "Step-Up Security Verification";
        document.getElementById("stepUpModalDesc").textContent = opts.desc || "";
        const pinInput = document.getElementById("stepUpModalPinInput");
        pinInput.value = "";

        const modal = document.getElementById("stepUpModal");
        modal.classList.add("open");
        modal.classList.add("active");
        pinInput.focus();
    }

    // ── Utilities ────────────────────────────────────────────────────────────
    function formatCurrency(amount) {
        if (typeof window.formatGlobalCurrency === "function") {
            return window.formatGlobalCurrency(amount);
        }
        const symbol = typeof window.getCurrencySymbol === "function" ? window.getCurrencySymbol() : "₹";
        const isAlpha = /^[A-Z]{3}$/.test(symbol);
        const formatted = Number(amount || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return isAlpha ? `${symbol} ${formatted}` : `${symbol}${formatted}`;
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

})();
