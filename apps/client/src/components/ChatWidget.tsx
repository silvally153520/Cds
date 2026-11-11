import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  Check,
  ChevronDown,
  CornerDownLeft,
  MessageCircle,
  Send,
  X,
} from 'lucide-react';
import { getAuthToken } from '../lib/api';
import { getCityLabel } from '../lib/location';
import { propertyTypeLabels } from '../lib/propertyCategories';
import './ChatWidget.css';

type RoomResult = {
  id: string;
  name: string;
  type: string;
  basePrice: number;
  maxGuests: number;
  availableRooms: number;
  availabilityChecked?: boolean;
  averageNightlyPrice?: boolean;
  images: string[];
  amenities: string[];
  property: {
    id: string;
    name: string;
    city?: string | null;
    district?: string;
    type: string;
  };
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date | null;
  results?: RoomResult[];
};

type ChatResponse = {
  conversationId?: string;
  answer?: string;
  results?: RoomResult[];
  message?: string;
};

const welcomeMessage = `Xin chào! Tôi là trợ lý AI của Sieuechxanh.

Tôi có thể giúp bạn tìm khách sạn, resort, biệt thự và phòng nghỉ phù hợp với nhu cầu của mình.

Bạn đang muốn tìm phòng ở đâu?`;

const suggestions = [
  'Tìm khách sạn',
  'Tìm resort',
  'Tìm phòng giá rẻ',
  'Tìm phòng ở Đà Nẵng',
  'Hướng dẫn đặt phòng',
];

const money = (amount: number) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(amount);

function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isRoomResult(value: unknown): value is RoomResult {
  if (typeof value !== 'object' || value === null) return false;
  const room = value as Partial<RoomResult>;
  return typeof room.id === 'string'
    && typeof room.name === 'string'
    && typeof room.basePrice === 'number'
    && typeof room.property?.name === 'string'
    && typeof room.property?.type === 'string';
}

function renderInline(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s]+)/g);
  return tokens.map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**')) return <strong key={index}>{token.slice(2, -2)}</strong>;
    if (token.startsWith('`') && token.endsWith('`')) return <code key={index}>{token.slice(1, -1)}</code>;
    if (/^https?:\/\//i.test(token)) {
      const cleanUrl = token.replace(/[.,!?;:]+$/, '');
      const trailing = token.slice(cleanUrl.length);
      return <span key={index}><a href={cleanUrl} target="_blank" rel="noreferrer">{cleanUrl}</a>{trailing}</span>;
    }
    return <span key={index}>{token}</span>;
  });
}

function MessageContent({ content }: { content: string }) {
  const blocks: Array<{ type: 'paragraph' | 'list'; lines: string[] }> = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', lines: paragraph });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ type: 'list', lines: list });
    list = [];
  };

  for (const line of content.split('\n')) {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();

  return <div className="sx-chat-markdown">{blocks.map((block, index) => block.type === 'list'
    ? <ul key={index}>{block.lines.map((line, lineIndex) => <li key={lineIndex}>{renderInline(line)}</li>)}</ul>
    : <p key={index}>{block.lines.map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && <br />}{renderInline(line)}</span>)}</p>)}</div>;
}

function RoomResults({ rooms }: { rooms: RoomResult[] }) {
  if (!rooms.length) return null;
  return <div className="sx-chat-results">
    {rooms.map((room) => <article className="sx-chat-room" key={room.id}>
      <Link to={`/rooms/${encodeURIComponent(room.id)}`} className="sx-chat-room-image" aria-label={`Xem ${room.name}`}>
        {room.images[0] ? <img src={room.images[0]} alt="" /> : <span><Bot size={23} /></span>}
      </Link>
      <div className="sx-chat-room-body">
        <p className="sx-chat-room-category">{propertyTypeLabels[room.property.type] ?? room.property.type}</p>
        <Link to={`/rooms/${encodeURIComponent(room.id)}`} className="sx-chat-room-name">{room.property.name}</Link>
        <p className="sx-chat-room-title">{room.name}</p>
        <p className="sx-chat-room-location">{room.property.district ? `${room.property.district}, ` : ''}{getCityLabel(room.property.city)} · tối đa {room.maxGuests} khách</p>
        {room.availabilityChecked && <p className="sx-chat-room-availability">{room.availableRooms} phòng còn trống trong ngày đã chọn</p>}
        {room.amenities.length > 0 && <div className="sx-chat-room-amenities">{room.amenities.slice(0, 3).map((amenity) => <span key={amenity}>{amenity}</span>)}</div>}
        <div className="sx-chat-room-footer"><strong>{money(room.basePrice)} <small>{room.averageNightlyPrice ? 'TB / đêm' : '/ đêm'}</small></strong><Link to={`/rooms/${encodeURIComponent(room.id)}`}>Xem phòng <CornerDownLeft size={13} /></Link></div>
      </div>
    </article>)}
  </div>;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conversationId, setConversationId] = useState(makeId);
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: makeId(),
    role: 'assistant',
    content: welcomeMessage,
    createdAt: null,
  }]);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || minimized) return;
    const list = messageListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [open, minimized, loading, messages]);

  useEffect(() => {
    if (!open || minimized) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open, minimized]);

  const sendMessage = async (value: string) => {
    const content = value.trim();
    if (!content || loading || content.length > 1200) return;

    const userMessage: ChatMessage = { id: makeId(), role: 'user', content, createdAt: new Date() };
    const previousMessages = messages
      .filter((message) => message.id !== messages[0]?.id || message.role !== 'assistant')
      .slice(-10)
      .map(({ role, content: text }) => ({ role, content: text }));
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    let historySize = 0;
    for (const previous of previousMessages.reverse()) {
      if (historySize + previous.content.length > 8000) break;
      history.unshift(previous);
      historySize += previous.content.length;
    }
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      const token = getAuthToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      const endpoint = import.meta.env.VITE_AI_API_URL?.trim() || '/api/ai';
      const response = await fetch(`${endpoint.replace(/\/+$/, '')}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: content, conversationId, history }),
      });
      const data = await response.json() as ChatResponse;
      if (!response.ok) throw new Error(data.message ?? 'Trợ lý AI tạm thời chưa khả dụng.');
      if (data.conversationId) setConversationId(data.conversationId);
      const resultRooms = Array.isArray(data.results) ? data.results.filter(isRoomResult) : [];
      setMessages((current) => [...current, {
        id: makeId(),
        role: 'assistant',
        content: data.answer?.trim() || 'Mình đã tìm thấy thông tin phù hợp. Bạn có thể xem các lựa chọn bên dưới.',
        createdAt: new Date(),
        ...(resultRooms.length ? { results: resultRooms } : {}),
      }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể kết nối trợ lý AI. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendMessage(input);
    }
  };

  return <>
    {!open && <button type="button" className="sx-chat-launcher" aria-label="Mở Trợ lý AI Sieuechxanh" title="Trợ lý AI Sieuechxanh" onClick={() => { setOpen(true); setMinimized(false); }}>
      <MessageCircle size={25} strokeWidth={2.2} /><span className="sx-chat-launcher-ping" />
    </button>}

    {open && <section className={`sx-chat-window ${minimized ? 'is-minimized' : ''}`} aria-label="Trợ lý AI Sieuechxanh">
      <header className="sx-chat-header">
        <span className="sx-chat-brand-icon"><Bot size={21} /></span>
        <div className="sx-chat-heading"><strong>Trợ lý AI</strong><span><i /> Đang hỗ trợ</span></div>
        <div className="sx-chat-header-actions">
          <button type="button" aria-label={minimized ? 'Mở rộng cửa sổ chat' : 'Thu nhỏ cửa sổ chat'} onClick={() => setMinimized((current) => !current)}><ChevronDown className={minimized ? 'is-expanded' : ''} size={19} /></button>
          <button type="button" aria-label="Đóng chatbot" onClick={() => setOpen(false)}><X size={19} /></button>
        </div>
      </header>

      {!minimized && <>
        <div className="sx-chat-body" ref={messageListRef} aria-live="polite">
          <div className="sx-chat-day-divider"><span>Sieuechxanh · Trợ lý đặt phòng</span></div>
          {messages.map((message) => <article key={message.id} className={`sx-chat-message is-${message.role}`}>
            {message.role === 'assistant' && <span className="sx-chat-avatar"><Bot size={16} /></span>}
            <div className="sx-chat-message-content">
              <div className="sx-chat-bubble"><MessageContent content={message.content} /></div>
              {message.results && <RoomResults rooms={message.results} />}
              {message.createdAt && <time>{message.createdAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time>}
            </div>
            {message.role === 'user' && <span className="sx-chat-user-check"><Check size={12} /></span>}
          </article>)}
          {messages.length === 1 && <div className="sx-chat-suggestions"><span>Gợi ý cho bạn</span><div>{suggestions.map((suggestion) => <button key={suggestion} type="button" disabled={loading} onClick={() => void sendMessage(suggestion)}>{suggestion}</button>)}</div></div>}
          {loading && <div className="sx-chat-message is-assistant"><span className="sx-chat-avatar"><Bot size={16} /></span><div className="sx-chat-bubble sx-chat-typing" role="status" aria-label="Trợ lý đang trả lời"><i /><i /><i /></div></div>}
          {error && <div className="sx-chat-error" role="alert">{error}</div>}
        </div>
        <form className="sx-chat-composer" onSubmit={submit}>
          <label className="sx-chat-input-wrap">
            <span className="sr-only">Nhập tin nhắn cho trợ lý AI</span>
            <textarea value={input} maxLength={1200} rows={1} placeholder="Hỏi về phòng nghỉ…" onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} />
            <small>{input.length}/1200 · Enter để gửi</small>
          </label>
          <button type="submit" className="sx-chat-send" aria-label="Gửi tin nhắn" disabled={loading || !input.trim()}><Send size={17} /></button>
        </form>
        <footer className="sx-chat-disclaimer"><Bot size={13} /> AI có thể nhầm lẫn. Giá và phòng được lấy từ dữ liệu thực tế.</footer>
      </>}
    </section>}
  </>;
}
