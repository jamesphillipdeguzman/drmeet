import type { UnifiedMessage } from "./MessageBoard";

type ChatThreadProps = {
  patientName: string;
  messages: UnifiedMessage[];
  onClose: () => void;
};

export function ChatThread(props: ChatThreadProps) {
  return {
    kind: "ChatThread",
    close() {
      props.onClose();
    },
    toHtml() {
      const items = props.messages
        .map(
          (message) => `
            <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div class="mb-1 flex items-center justify-between text-xs text-slate-500">
                <span>${message.channel.toUpperCase()}</span>
                <span>${new Date(message.createdAt).toLocaleString()}</span>
              </div>
              <p class="text-sm text-slate-700">${message.body}</p>
            </div>
          `
        )
        .join("");
      return `
        <aside class="fixed right-0 top-0 z-50 h-full w-full max-w-md border-l border-slate-200 bg-white p-4 shadow-2xl">
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-900">${props.patientName} Thread</h3>
          </div>
          <div class="space-y-3">${items}</div>
        </aside>
      `;
    },
  };
}

