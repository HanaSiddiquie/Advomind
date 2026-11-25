// frontend/src/pages/AdvoChat.js
import PageContainer from "../components/ui/PageContainer";
import ChatPanel from "../components/ChatPanel";

function AdvoChat() {
  return (
    <PageContainer
      title="AdvoChat"
      subtitle="Ask about Pakistani statutes — answers cite the sections they come from"
    >
      <ChatPanel />
    </PageContainer>
  );
}

export default AdvoChat;