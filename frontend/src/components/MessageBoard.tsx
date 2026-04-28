export type UnifiedMessage = {
  id: string;
  patientId: string;
  patientName: string;
  body: string;
  channel: "sms" | "email" | "web_portal";
  createdAt: string;
  status: "pending" | "confirmed";
  read: boolean;
  isNew?: boolean;
};

type MessageBoardProps = {
  messages: UnifiedMessage[];
  onOpenThread: (patientId: string) => void;
  onSendReply: (patientId: string, content: string, channel: UnifiedMessage["channel"]) => Promise<void>;
};

export function MessageBoard(props: MessageBoardProps) {
  return {
    kind: "MessageBoard",
    messageCount: props.messages.length,
    openThread(patientId: string) {
      props.onOpenThread(patientId);
    },
    async sendReply(patientId: string, content: string, channel: UnifiedMessage["channel"]) {
      await props.onSendReply(patientId, content, channel);
    },
    toHtml() {
      return props.messages
        .map((message) => {
          const badge = message.isNew
            ? '<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">New</span>'
            : "";
          return `
            <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div class="mb-2 flex items-center justify-between">
                <h4 class="font-semibold text-slate-900">${message.patientName}</h4>
                ${badge}
              </div>
              <p class="text-sm text-slate-600">${message.body}</p>
            </article>
          `;
        })
        .join("");
    },
  };
}

