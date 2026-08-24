/**
 * frontend/src/js/modules/messaging.js
 * Real-Time Messaging Layer
 */

import {
    API_ORIGIN,
    API_BASE,
    DEFAULT_AVATAR_URL,
    MESSAGES_API,
    DASHBOARD_STATE_KEY,
    DASH_TAG_FLOAT,
    DASH_TAG_HOME,
} from "../config/api.js";

import { fileToDataUrl, showToast } from "../core/ui.js";

// Note: Ensure you export these helpers from app.js or another core file so this module can consume them.
import {
    apiRequest,
    buildHeaders,
    getApiErrorMessage,
    getCurrentUserId,
    getCurrentUserRole,
    isLoggedIn,
    resolveDoctorIdForPatientMessaging,
    participantDisplayName,
    participantAvatarUrl,
    conversationTypingLabel,
    wireMessengerShell,
    messengerUi,
    createSkeletonRows,
    buildThreadMessagesHtml,
    clearMessengerAttachmentPreview,
    showComposeMessageModal,
} from "../app.js";

import { authState } from "../state/auth-state.js";

export const dashboardSubscribers = [];
export const dashboardState = {
    conversations: [],
    activeConversationId: "",
    messages: [],
    typingByConversation: {},
    websocketActive: false,
    socketReconnecting: false,
    socketAwaitingFirstConnect: true,
    conversationSearchFilter: "",
};

export let socket = null;
export let socketInitialized = false;

// --- State Management ---

export function loadDashboardState() {
    try {
        const parsed = JSON.parse(
            localStorage.getItem(DASHBOARD_STATE_KEY) || "{}"
        );
        if (Array.isArray(parsed.conversations))
            dashboardState.conversations = parsed.conversations;
        if (typeof parsed.activeConversationId === "string")
            dashboardState.activeConversationId = parsed.activeConversationId;
        if (Array.isArray(parsed.messages))
            dashboardState.messages = parsed.messages;
    } catch (error) {
        console.warn("Unable to load dashboard state", error);
    }
}

export function persistDashboardState() {
    const snapshot = {
        conversations: dashboardState.conversations,
        activeConversationId: dashboardState.activeConversationId,
        messages: dashboardState.messages,
    };
    localStorage.setItem(DASHBOARD_STATE_KEY, JSON.stringify(snapshot));
}

export function subscribeDashboard(listener) {
    dashboardSubscribers.push(listener);
}

export function pruneDashboardSubscribers(tag) {
    for (let i = dashboardSubscribers.length - 1; i >= 0; i--) {
        if (dashboardSubscribers[i]._dashTag === tag) {
            dashboardSubscribers.splice(i, 1);
        }
    }
}

export function notifyDashboardSubscribers() {
    dashboardSubscribers.forEach((listener) => listener(dashboardState));
}

// --- Socket & Infrastructure ---

export function resetMessagingSocket() {
    if (socket) {
        try {
            socket.removeAllListeners();
            socket.disconnect();
        } catch (e) {
            /* ignore */
        }
        socket = null;
    }
    socketInitialized = false;
    dashboardState.websocketActive = false;
    dashboardState.socketReconnecting = false;
    dashboardState.socketAwaitingFirstConnect = true;
    dashboardState.typingByConversation = {};
}

export function setupSocket() {
    if (socketInitialized) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    if (typeof window.io !== "function") return;

    socketInitialized = true;
    socket = window.io(API_ORIGIN, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
        timeout: 15000,
    });

    socket.io.on("reconnect_attempt", () => {
        dashboardState.socketReconnecting = true;
        dashboardState.messages = [];
        persistDashboardState();
        notifyDashboardSubscribers();
    });

    socket.on("connect", async () => {
        dashboardState.websocketActive = true;
        dashboardState.socketReconnecting = false;
        dashboardState.socketAwaitingFirstConnect = false;
        try {
            await loadConversations();
            if (dashboardState.activeConversationId) {
                await loadMessages(dashboardState.activeConversationId);
            }
        } catch (e) {
            /* ignore */
        }
        persistDashboardState();
        notifyDashboardSubscribers();
    });

    socket.on("disconnect", () => {
        dashboardState.websocketActive = false;
        dashboardState.socketReconnecting = true;
        dashboardState.socketAwaitingFirstConnect = false;
        dashboardState.messages = [];
        persistDashboardState();
        notifyDashboardSubscribers();
    });

    socket.on("reconnect", () => {
        dashboardState.socketReconnecting = false;
        dashboardState.socketAwaitingFirstConnect = false;
        notifyDashboardSubscribers();
    });

    socket.on("newMessage", async (msg) => {
        const incomingConversationId = msg?.conversationId || msg?.conversation_id;
        if (!incomingConversationId) return;

        const conversationId = String(incomingConversationId);
        const isActive =
            String(dashboardState.activeConversationId) === conversationId;
        const typingSet = dashboardState.typingByConversation?.[conversationId];
        if (typingSet instanceof Set) typingSet.clear();

        const idx = dashboardState.conversations.findIndex(
            (c) => String(c._id) === conversationId,
        );
        if (idx !== -1) {
            dashboardState.conversations[idx] = {
                ...dashboardState.conversations[idx],
                lastMessage:
                    msg?.message || dashboardState.conversations[idx].lastMessage,
                lastMessageAt:
                    msg?.createdAt || dashboardState.conversations[idx].lastMessageAt,
            };
        }

        if (isActive) {
            const incomingId = msg?._id || msg?.id;
            const alreadyExists =
                incomingId &&
                dashboardState.messages.some(
                    (m) => String(m._id || m.id) === String(incomingId),
                );
            if (!alreadyExists)
                dashboardState.messages = [...dashboardState.messages, msg];

            try {
                await apiRequest(
                    `${MESSAGES_API}/conversations/${conversationId}/read`,
                    { method: "POST" },
                );
            } catch (e) {
                // ignore
            }
        }

        persistDashboardState();
        notifyDashboardSubscribers();
    });

    socket.on("typing:update", (payload = {}) => {
        const conversationId = String(payload.conversationId || "");
        const fromUserId = String(payload.userId || "");
        if (!conversationId || !fromUserId) return;
        if (!dashboardState.typingByConversation[conversationId]) {
            dashboardState.typingByConversation[conversationId] = new Set();
        }
        const set = dashboardState.typingByConversation[conversationId];
        if (payload.typing) set.add(fromUserId);
        else set.delete(fromUserId);
        notifyDashboardSubscribers();
    });
}

// --- Messaging API Operations ---

export async function loadConversations() {
    try {
        const res = await apiRequest(`${MESSAGES_API}/conversations`);
        if (!res.ok) throw new Error("Failed to load conversations");
        const data = await res.json();
        dashboardState.conversations = Array.isArray(data?.conversations)
            ? data.conversations
            : [];

        persistDashboardState();
        notifyDashboardSubscribers();
    } catch (error) {
        notifyDashboardSubscribers();
    }
}

export async function loadMessages(conversationId) {
    try {
        if (!conversationId) {
            dashboardState.messages = [];
            return;
        }
        const res = await apiRequest(
            `${MESSAGES_API}/conversations/${conversationId}/messages`,
        );
        if (!res.ok) throw new Error("Failed to load messages");
        const data = await res.json();
        dashboardState.messages = Array.isArray(data?.messages)
            ? data.messages
            : [];

        await apiRequest(`${MESSAGES_API}/conversations/${conversationId}/read`, {
            method: "POST",
        });
    } catch (error) {
        dashboardState.messages = [];
    } finally {
        persistDashboardState();
        notifyDashboardSubscribers();
    }
}

async function createOrGetConversation(patientId, doctorId) {
    const res = await apiRequest(
        `${MESSAGES_API}/conversations/ensure/patient-doctor`,
        {
            method: "POST",
            headers: buildHeaders({
                "Content-Type": "application/json",
            }),
            body: JSON.stringify({ patientId, doctorId }),
        }
    );

    if (!res.ok) {
        const errorText = await res.text();
        console.error("CREATE CONV ERROR:", errorText);
        throw new Error(errorText || "Failed to create conversation");
    }

    const data = await res.json();
    return data.conversationId;
}

export async function startConversationWithRecipient(recipientUserId, shellRoot = null) {
    const currentUserId = getCurrentUserId();
    const role = getCurrentUserRole();
    if (!currentUserId || !recipientUserId) return null;

    const patientId = role === "patient" ? currentUserId : recipientUserId;
    const doctorId = role === "patient" ? (await resolveDoctorIdForPatientMessaging()) : currentUserId;

    try {
        const convId = await createOrGetConversation(patientId, doctorId);
        if (convId) {
            dashboardState.activeConversationId = String(convId);
            await loadConversations();
            await loadMessages(convId);
            const root = shellRoot || document.getElementById("floating-messenger-root");
            if (root) {
                renderMessengerConversationList(root);
                renderMessengerThread(root);
            }
            return convId;
        }
    } catch (e) {
        console.error("Failed to start conversation:", e);
    }
    return null;
}

export async function sendMessage(text, options = {}) {
    let conversationId =
        options.conversationId || dashboardState.activeConversationId;

    const userId = getCurrentUserId();
    const role = getCurrentUserRole();

    if (!userId) {
        throw new Error("You must be logged in to send a message.");
    }

    if (!conversationId) {
        if (role !== "patient" && !(options.patientId && options.doctorId)) {
            throw new Error("Select a conversation before sending a message.");
        }
        const doctorId =
            options.doctorId || (await resolveDoctorIdForPatientMessaging());
        const patientId = options.patientId || userId;
        if (!doctorId) {
            throw new Error(
                "No assigned doctor found. Book an appointment first so messaging can be enabled."
            );
        }
        const createdConversationId = await createOrGetConversation(
            patientId,
            doctorId
        );

        conversationId = createdConversationId;
        dashboardState.activeConversationId = conversationId;
    }

    const res = await apiRequest(`${MESSAGES_API}/send`, {
        method: "POST",
        headers: buildHeaders({
            "Content-Type": "application/json",
        }),
        body: JSON.stringify({
            conversationId,
            message: text,
            fileData: options.fileData || "",
            attachmentName: options.attachmentName || "",
            attachmentType: options.attachmentType || "",
        }),
    });

    if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, "Unable to send message"));
    }

    const data = await res.json();

    dashboardState.activeConversationId = String(
        data?.conversationId || conversationId
    );

    if (data?.message) {
        dashboardState.messages = [...dashboardState.messages, data.message];
    }

    const idx = dashboardState.conversations.findIndex(
        (c) => String(c._id) === String(conversationId)
    );

    if (idx !== -1 && data?.conversation) {
        dashboardState.conversations[idx] = data.conversation;
    }

    persistDashboardState();
    notifyDashboardSubscribers();

    const cid = dashboardState.activeConversationId;
    if (cid) {
        await loadMessages(cid);
    }
}

export async function sendDocumentMessage({
    conversationId = "",
    patientId = "",
    doctorId = "",
    text = "",
    file,
}) {
    const fileData = await fileToDataUrl(file);
    return sendMessage(text, {
        conversationId,
        patientId,
        doctorId,
        fileData,
        attachmentName: file?.name || "",
        attachmentType: file?.type || "",
    });
}

// --- Renderers & UI Interactions ---

function isNearBottom(el, threshold = 100) {
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

let patientSearchDebounceTimer = null;
let lastPatientSearchQuery = "";
let cachedPatientSearchResults = [];
let isSearchingPatients = false;

export function renderMessengerConversationList(rootEl) {
    const ui = messengerUi(rootEl);
    if (!ui.list || !isLoggedIn()) return;
    const currentUserId = getCurrentUserId();
    const currentUserRole = String(getCurrentUserRole() || "").toLowerCase();
    const needle = String(dashboardState.conversationSearchFilter || "")
        .trim()
        .toLowerCase();

    // Adapt search placeholder for clinical staff
    const searchInput = rootEl.querySelector("[data-messenger-search]");
    if (searchInput && (currentUserRole === "doctor" || currentUserRole === "receptionist")) {
        searchInput.placeholder = "Search conversations or patients…";
    }

    const conversations = Array.isArray(dashboardState.conversations)
        ? dashboardState.conversations
        : [];
    const sorted = [...conversations].sort((a, b) => {
        const left = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const right = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return right - left;
    });

    const filtered = sorted.filter((conv) => {
        if (!needle) return true;
        const participants = Array.isArray(conv.participants)
            ? conv.participants
            : [];
        const other =
            participants.find((p) => String(p._id) !== String(currentUserId)) ||
            participants[0] ||
            null;
        const name = participantDisplayName(other).toLowerCase();
        const last = String(conv.lastMessage || "").toLowerCase();
        return name.includes(needle) || last.includes(needle);
    });

    // Trigger debounced patient search for doctor accounts when search query is active
    if ((currentUserRole === "doctor" || currentUserRole === "receptionist") && needle) {
        if (needle !== lastPatientSearchQuery) {
            clearTimeout(patientSearchDebounceTimer);
            patientSearchDebounceTimer = setTimeout(async () => {
                lastPatientSearchQuery = needle;
                isSearchingPatients = true;
                try {
                    const res = await apiRequest(
                        `${API_BASE}/doctors/me/patients?q=${encodeURIComponent(needle)}&limit=10`
                    );
                    if (res.ok) {
                        const data = await res.json();
                        cachedPatientSearchResults = Array.isArray(data.patients) ? data.patients : [];
                    } else {
                        cachedPatientSearchResults = [];
                    }
                } catch {
                    cachedPatientSearchResults = [];
                } finally {
                    isSearchingPatients = false;
                    renderMessengerConversationList(rootEl);
                }
            }, 160);
        }
    } else if (!needle) {
        cachedPatientSearchResults = [];
        lastPatientSearchQuery = "";
    }

    // Simple escape shim inside if not imported 
    const esc = (str) => String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    let convHtml = "";
    if (filtered.length) {
        convHtml = filtered
            .map((conv) => {
                const participants = Array.isArray(conv.participants)
                    ? conv.participants
                    : [];
                const other =
                    participants.find((p) => String(p._id) !== String(currentUserId)) ||
                    participants[0] ||
                    null;
                const otherName = participantDisplayName(other);
                const otherAvatar = participantAvatarUrl(other);
                const lastMsg = conv.lastMessage || "";
                const typingLabel = conversationTypingLabel(conv._id, currentUserId);
                const active =
                    String(dashboardState.activeConversationId) === String(conv._id);

                return `
            <button type="button" class="messenger-conv-row ${active ? "messenger-conv-row--active" : ""}" data-select-conversation="${conv._id}">
              <img class="person-avatar" src="${esc(otherAvatar)}" alt="" />
              <div class="messenger-conv-meta">
                <span class="messenger-conv-name">${esc(otherName)}</span>
                <span class="messenger-conv-preview">${esc(typingLabel || lastMsg || "No messages yet")}</span>
              </div>
            </button>`;
            })
            .join("");
    }

    let patientHtml = "";
    if ((currentUserRole === "doctor" || currentUserRole === "receptionist") && needle && cachedPatientSearchResults.length) {
        const patientItems = cachedPatientSearchResults.map((p) => {
            const pUserId = p.userId ? String(p.userId) : "";
            const existingConv = pUserId
                ? conversations.find((c) =>
                    Array.isArray(c.participants) && c.participants.some((part) => String(part._id) === pUserId)
                  )
                : null;
            const fullName = `${p.title ? `${p.title} ` : ""}${p.firstName || ""} ${p.lastName || ""}`.trim() || "Patient";
            return {
                patient: p,
                displayName: fullName,
                existingConvId: existingConv?._id || "",
            };
        });

        patientHtml = `
            <div class="messenger-search-section-header" style="padding: 0.6rem 0.75rem 0.25rem; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted, #64748b); display: flex; align-items: center; justify-content: space-between;">
              <span>Patients (${patientItems.length})</span>
              <span style="font-size: 0.7rem; font-weight: normal; text-transform: none; color: #3b82f6;">Start chat</span>
            </div>
            ${patientItems
                .map(({ patient: p, displayName, existingConvId }) => `
                    <button type="button" class="messenger-conv-row messenger-patient-row" data-start-patient-chat="${esc(p._id)}" data-patient-user-id="${esc(p.userId || "")}" data-existing-conv-id="${esc(existingConvId)}" data-patient-name="${esc(displayName)}">
                      <img class="person-avatar" src="${esc(p.photoUrl || DEFAULT_AVATAR_URL)}" alt="" />
                      <div class="messenger-conv-meta">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                          <span class="messenger-conv-name">${esc(displayName)}</span>
                          <span class="badge" style="font-size: 0.68rem; padding: 2px 6px; background: #e0f2fe; color: #0284c7; border-radius: 4px; font-weight: 600;">${existingConvId ? "Open Chat" : "New Chat"}</span>
                        </div>
                        <span class="messenger-conv-preview" style="color: var(--text-muted, #64748b); font-size: 0.78rem;">${esc(p.email || p.phone || "Patient")}</span>
                      </div>
                    </button>
                `)
                .join("")}
        `;
    }

    if (convHtml || patientHtml) {
        ui.list.innerHTML = convHtml + patientHtml;
    } else if (isSearchingPatients) {
        ui.list.innerHTML = `<div class="feedback messenger-empty-inbox">Searching patients…</div>`;
    } else {
        ui.list.innerHTML = `<div class="feedback messenger-empty-inbox">No conversations or patients match.</div>`;
    }

    ui.list.querySelectorAll("[data-select-conversation]").forEach((row) => {
        row.addEventListener("click", async () => {
            const conversationId = row.getAttribute("data-select-conversation");
            if (!conversationId) return;
            dashboardState.activeConversationId = String(conversationId);
            ui.layout?.classList.add("messenger-show-thread");
            await loadMessages(conversationId);
            notifyDashboardSubscribers();
        });
    });

    ui.list.querySelectorAll("[data-start-patient-chat]").forEach((row) => {
        row.addEventListener("click", async () => {
            const patientId = row.getAttribute("data-start-patient-chat");
            const existingConvId = row.getAttribute("data-existing-conv-id");
            if (!patientId && !existingConvId) return;

            if (existingConvId) {
                dashboardState.activeConversationId = String(existingConvId);
                ui.layout?.classList.add("messenger-show-thread");
                await loadMessages(existingConvId);
                notifyDashboardSubscribers();
                return;
            }

            row.style.pointerEvents = "none";
            row.style.opacity = "0.7";
            const previewEl = row.querySelector(".messenger-conv-preview");
            if (previewEl) previewEl.textContent = "Starting conversation…";

            try {
                const res = await apiRequest(`${API_BASE}/messages/conversations/ensure/patient-doctor`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        patientId,
                        doctorId: currentUserId,
                    }),
                });

                if (!res.ok) {
                    throw new Error(await getApiErrorMessage(res, "Failed to start conversation."));
                }

                const data = await res.json();
                const newConvId = String(data.conversationId || "");
                if (newConvId) {
                    await loadConversations();
                    dashboardState.activeConversationId = newConvId;
                    ui.layout?.classList.add("messenger-show-thread");
                    await loadMessages(newConvId);
                    notifyDashboardSubscribers();
                }
            } catch (err) {
                showToast(err?.message || "Failed to start conversation.", "error");
                row.style.pointerEvents = "auto";
                row.style.opacity = "1";
                if (previewEl) previewEl.textContent = "Error starting chat";
            }
        });
    });
}
function scrollToRecentMessage(scrollContainer, force = false) {
    if (!scrollContainer) return;
    const distanceFromBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
    if (force || distanceFromBottom < 150) {
        requestAnimationFrame(() => {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        });
    }
}

export function renderMessengerThread(rootEl) {
    if (!rootEl || !isLoggedIn()) return;
    wireMessengerShell(rootEl);
    const ui = messengerUi(rootEl);
    const conversationId = dashboardState.activeConversationId;

    if (!conversationId) {
        ui.layout?.classList.remove("messenger-show-thread");
        ui.active?.classList.add("hidden");
        ui.empty?.classList.remove("hidden");
        return;
    }

    const conv = dashboardState.conversations.find(
        (c) => String(c._id) === String(conversationId)
    );
    const participants = Array.isArray(conv?.participants)
        ? conv.participants
        : [];
    const currentUserId = getCurrentUserId();
    const other =
        participants.find((p) => String(p._id) !== String(currentUserId)) ||
        participants[0] ||
        null;
    const otherName = participantDisplayName(other);
    const otherAvatar = participantAvatarUrl(other);
    const typingLabel = conversationTypingLabel(conversationId, currentUserId);

    ui.empty?.classList.add("hidden");
    ui.active?.classList.remove("hidden");
    ui.layout?.classList.add("messenger-show-thread");
    if (ui.peerAvatar) {
        ui.peerAvatar.src = otherAvatar;
        ui.peerAvatar.alt = `${otherName} avatar`;
    }
    if (ui.peerName) ui.peerName.textContent = otherName;
    if (ui.typing) ui.typing.textContent = typingLabel || "";

    if (ui.scroll) {
        const isNewThread = rootEl.dataset.messengerConversationId !== String(conversationId);
        ui.scroll.innerHTML = buildThreadMessagesHtml(
            dashboardState.messages,
            currentUserId
        );

        scrollToRecentMessage(ui.scroll, isNewThread);
    }

    const conversationIdRef = String(conversationId);
    if (rootEl.dataset.messengerConversationId !== conversationIdRef) {
        rootEl.dataset.messengerConversationId = conversationIdRef;
        clearMessengerAttachmentPreview(rootEl);
    }
    let typingStopTimer = null;
    const emitTypingStart = () => {
        if (!socket || !conversationIdRef) return;
        socket.emit("typing:start", { conversationId: conversationIdRef });
    };
    const emitTypingStop = () => {
        if (!socket || !conversationIdRef) return;
        socket.emit("typing:stop", { conversationId: conversationIdRef });
    };

    const textarea = rootEl.querySelector("[data-messenger-reply-text]");
    const sendBtn = rootEl.querySelector("[data-messenger-send]");
    const fileInput = rootEl.querySelector("[data-messenger-file-input]");

    if (textarea) {
        textarea.oninput = () => {
            const hasText = String(textarea.value || "").trim().length > 0;
            if (!hasText) {
                emitTypingStop();
                return;
            }
            emitTypingStart();
            if (typingStopTimer) clearTimeout(typingStopTimer);
            typingStopTimer = setTimeout(() => emitTypingStop(), 900);
        };
        textarea.onblur = () => {
            if (typingStopTimer) clearTimeout(typingStopTimer);
            emitTypingStop();
        };
    }

    const sendAction = async () => {
        if (sendBtn?.dataset.sending === "1") return;
        const content = String(textarea?.value || "").trim();
        const file = fileInput?.files?.[0];
        if ((!content && !file) || !conversationIdRef) return;
        dashboardState.activeConversationId = conversationIdRef;
        try {
            if (sendBtn) sendBtn.dataset.sending = "1";
            if (file) {
                await sendDocumentMessage({
                    conversationId: conversationIdRef,
                    text: content,
                    file,
                });
            } else {
                await sendMessage(content);
            }
            if (textarea) textarea.value = "";
            clearMessengerAttachmentPreview(rootEl);
            if (typingStopTimer) clearTimeout(typingStopTimer);
            emitTypingStop();
            scrollToRecentMessage(ui.scroll, true);
        } catch (err) {
            showToast(err?.message || "Unable to send message", "error");
        } finally {
            if (sendBtn) sendBtn.dataset.sending = "0";
        }
    };

    if (sendBtn) sendBtn.onclick = sendAction;
}

export function mountFloatingChatWidget() {
    if (!isLoggedIn()) return;
    const root = document.getElementById("floating-chat-widget");
    const panel = document.getElementById("floating-chat-panel");
    const toggleBtn = document.getElementById("floating-chat-toggle");
    const closeBtn = document.getElementById("floating-chat-close");
    const shellRoot = document.getElementById("floating-messenger-root");
    if (!root || !panel || !shellRoot) return;

    root.classList.remove("hidden");
    root.setAttribute("aria-hidden", "false");

    setupSocket();

    const updateLiveBadgeOnly = () => {
        const liveBadge = document.querySelector(".live-badge");
        if (liveBadge)
            liveBadge.classList.toggle("active", dashboardState.websocketActive);
    };

    pruneDashboardSubscribers(DASH_TAG_FLOAT);
    const floatListener = () => {
        renderMessengerConversationList(shellRoot);
        renderMessengerThread(shellRoot);
    };
    floatListener._dashTag = DASH_TAG_FLOAT;
    subscribeDashboard(floatListener);

    pruneDashboardSubscribers(DASH_TAG_HOME);
    const homeListener = () => updateLiveBadgeOnly();
    homeListener._dashTag = DASH_TAG_HOME;
    subscribeDashboard(homeListener);
    updateLiveBadgeOnly();

    wireMessengerShell(shellRoot);
    const ui = messengerUi(shellRoot);
    if (ui.list) ui.list.innerHTML = createSkeletonRows(3);
    renderMessengerConversationList(shellRoot);
    renderMessengerThread(shellRoot);

    if (!window.__drmeetMessagePoll) {
        window.__drmeetMessagePoll = setInterval(async () => {
            // Assume authState is imported from your app's state holder
            if (!isLoggedIn() || authState?.sessionExpired) return;
            const cid = dashboardState.activeConversationId;
            try {
                if (cid) await loadMessages(cid);
                await loadConversations();
            } catch (e) {
                /* ignore */
            }
        }, 2800);
    }

    if (!root.dataset.drmeetFloatReady) {
        root.dataset.drmeetFloatReady = "1";
        toggleBtn?.addEventListener("click", () => {
            panel.classList.toggle("hidden");
            const visible = !panel.classList.contains("hidden");
            if (visible) {
                loadConversations().then(() => {
                    renderMessengerConversationList(shellRoot);
                    renderMessengerThread(shellRoot);
                });
            }
            toggleBtn?.setAttribute("aria-expanded", visible ? "true" : "false");
        });
        closeBtn?.addEventListener("click", () => {
            panel.classList.add("hidden");
            toggleBtn?.setAttribute("aria-expanded", "false");
        });
        shellRoot
            .querySelector("[data-messenger-compose]")
            ?.addEventListener("click", () => {
                showComposeMessageModal(async (note) => {
                    try {
                        await sendMessage(note);
                        showToast("Message sent.");
                        renderMessengerConversationList(shellRoot);
                        renderMessengerThread(shellRoot);
                    } catch (err) {
                        showToast(err?.message || "Unable to send message", "error");
                    }
                });
            });
    }

    loadConversations().then(() => {
        renderMessengerConversationList(shellRoot);
        renderMessengerThread(shellRoot);
    });
}

export function hideFloatingChatWidget() {
    const root = document.getElementById("floating-chat-widget");
    const panel = document.getElementById("floating-chat-panel");
    const toggleBtn = document.getElementById("floating-chat-toggle");
    if (window.__drmeetMessagePoll) {
        clearInterval(window.__drmeetMessagePoll);
        window.__drmeetMessagePoll = null;
    }
    if (root) {
        root.classList.add("hidden");
        root.setAttribute("aria-hidden", "true");
    }
    panel?.classList.add("hidden");
    toggleBtn?.setAttribute("aria-expanded", "false");
    pruneDashboardSubscribers(DASH_TAG_FLOAT);
    pruneDashboardSubscribers(DASH_TAG_HOME);
}
