/**
 * frontend/src/js/modules/messaging.js
 * Real-Time Messaging Layer
 */

import {
    API_ORIGIN,
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

export function renderMessengerConversationList(rootEl) {
    const ui = messengerUi(rootEl);
    if (!ui.list || !isLoggedIn()) return;
    const currentUserId = getCurrentUserId();
    const needle = String(dashboardState.conversationSearchFilter || "")
        .trim()
        .toLowerCase();
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

    // Simple escape shim inside if not imported 
    const esc = (str) => String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    ui.list.innerHTML = filtered.length
        ? filtered
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
            .join("")
        : `<div class="feedback messenger-empty-inbox">No conversations match.</div>`;

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
}
function scrollToRecentMessage(scrollContainer) {
    if (!scrollContainer) return;
    requestAnimationFrame(() => {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
    });
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
        ui.scroll.innerHTML = buildThreadMessagesHtml(
            dashboardState.messages,
            currentUserId
        );

        scrollToRecentMessage(ui.scroll);
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
            if (ui.scroll) ui.scroll.scrollTop = ui.scroll.scrollHeight;
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
