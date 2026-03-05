import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Typography, Empty, Grid, List, Input, Button, Avatar, Space, Badge, Modal, message as antdMessage } from 'antd';
import { SendOutlined, ArrowLeftOutlined, DeleteOutlined } from '@ant-design/icons';
import { useWebSocket } from './contexts/WebSocketContext';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const API_BASE = 'http://localhost:3000';
const AUTH_TOKEN_KEY = 'dormease_token';

interface MessageItem {
  id: string | number;
  senderId: number;
  recipientId: number;
  text: string;
  timestamp: string;
  isMine: boolean;
}

interface ConversationItem {
  userId: number;
  userName: string;
  preview: string;
  unreadCount: number;
  updatedAt: string;
}

interface AuthMeResponse {
  user: {
    id: number;
  };
}

interface ConversationSummaryRow {
  id: number;
  full_name?: string;
  username?: string;
  relation?: 'tenant' | 'owner';
  last_message?: string;
  last_message_at?: string;
  last_sender_id?: number;
}

interface MessageHistoryRow {
  id: number;
  sender_id: number;
  recipient_id: number;
  message: string;
  created_at: string;
}

type Props = {
  onNavigate?: (section: string) => void;
};

const Messages: React.FC<Props> = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { sendMessage, onNewMessage, offNewMessage, isConnected } = useWebSocket();

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [messagesByUser, setMessagesByUser] = useState<Record<number, MessageItem[]>>({});
  const [draftMessage, setDraftMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingHistoryByUser, setLoadingHistoryByUser] = useState<Record<number, boolean>>({});
  const [deletingConversationId, setDeletingConversationId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadedHistoryRef = useRef<Record<number, boolean>>({});

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.userId === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const selectedMessages = useMemo(
    () => (selectedConversationId ? messagesByUser[selectedConversationId] ?? [] : []),
    [selectedConversationId, messagesByUser]
  );

  const filteredConversations = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    const sorted = [...conversations].sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );

    if (!keyword) {
      return sorted;
    }

    return sorted.filter((conversation) => {
      const name = conversation.userName.toLowerCase();
      const preview = conversation.preview.toLowerCase();
      return name.includes(keyword) || preview.includes(keyword);
    });
  }, [conversations, searchTerm]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedMessages]);

  const getDisplayName = (user: { id: number; full_name?: string; username?: string; relation?: 'tenant' | 'owner' }) => {
    const base = user.full_name || user.username || `User ${user.id}`;
    if (user.relation === 'tenant') {
      return `${base} (Tenant)`;
    }
    if (user.relation === 'owner') {
      return `${base} (Owner)`;
    }
    return base;
  };

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setLoadingContacts(false);
      return;
    }

    const loadConversations = async () => {
      try {
        setLoadingContacts(true);

        const [meRes, usersRes] = await Promise.all([
          fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/messages/conversations`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!meRes.ok || !usersRes.ok) {
          throw new Error('Failed to load contacts');
        }

        const meData: AuthMeResponse = await meRes.json();
        const usersData: ConversationSummaryRow[] = await usersRes.json();
        const myId = Number(meData.user.id);

        setCurrentUserId(myId);
        setConversations(
          usersData
            .filter((user) => Number(user.id) !== myId)
            .map((user) => ({
              userId: Number(user.id),
              userName: getDisplayName(user),
              preview: user.last_message
                ? Number(user.last_sender_id) === myId
                  ? `You: ${user.last_message}`
                  : user.last_message
                : 'Start a conversation',
              unreadCount: 0,
              updatedAt: user.last_message_at || new Date(0).toISOString(),
            }))
        );
      } catch {
        antdMessage.error('Unable to load users for messaging.');
      } finally {
        setLoadingContacts(false);
      }
    };

    loadConversations();
  }, []);

  useEffect(() => {
    const handleNewMessage = (data: any) => {
      const senderId = Number(data?.senderId);
      const recipientId = Number(data?.recipientId || currentUserId || 0);
      const incomingText = String(data?.message ?? '').trim();
      if (!senderId || !incomingText) {
        return;
      }

      const incomingTimestamp = data?.timestamp || new Date().toISOString();
      const senderName = data?.senderEmail || `User ${senderId}`;

      const incoming: MessageItem = {
        id: data?.id ?? `${Date.now()}-${Math.random()}`,
        senderId,
        recipientId,
        text: incomingText,
        timestamp: incomingTimestamp,
        isMine: false,
      };

      setMessagesByUser((previous) => ({
        ...previous,
        [senderId]: [...(previous[senderId] ?? []), incoming],
      }));

      setConversations((previous) => {
        const existing = previous.find((conversation) => conversation.userId === senderId);

        if (!existing) {
          return [
            {
              userId: senderId,
              userName: senderName,
              preview: incomingText,
              unreadCount: selectedConversationId === senderId ? 0 : 1,
              updatedAt: incomingTimestamp,
            },
            ...previous,
          ];
        }

        return previous.map((conversation) => {
          if (conversation.userId !== senderId) {
            return conversation;
          }
          return {
            ...conversation,
            preview: incomingText,
            unreadCount: selectedConversationId === senderId ? 0 : conversation.unreadCount + 1,
            updatedAt: incomingTimestamp,
          };
        });
      });

      if (selectedConversationId !== senderId) {
        antdMessage.info(`New message from ${senderName}`);
      }
    };

    onNewMessage(handleNewMessage);
    return () => {
      offNewMessage(handleNewMessage);
    };
  }, [currentUserId, selectedConversationId, onNewMessage, offNewMessage]);

  const getAvatarLabel = (name: string) => {
    const cleanName = name.trim();
    return cleanName.length ? cleanName.charAt(0).toUpperCase() : 'U';
  };

  const formatTime = (iso: string) => {
    if (!iso || new Date(iso).getTime() === 0) {
      return '';
    }
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const loadConversationHistory = async (userId: number) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token || loadedHistoryRef.current[userId]) {
      return;
    }

    setLoadingHistoryByUser((previous) => ({ ...previous, [userId]: true }));

    try {
      const res = await fetch(`${API_BASE}/messages/${userId}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to load conversation history');
      }

      const rows: MessageHistoryRow[] = await res.json();
      const history = rows.map((row) => ({
        id: row.id,
        senderId: Number(row.sender_id),
        recipientId: Number(row.recipient_id),
        text: row.message,
        timestamp: row.created_at,
        isMine: Number(row.sender_id) === currentUserId,
      }));

      setMessagesByUser((previous) => ({
        ...previous,
        [userId]: history,
      }));
      loadedHistoryRef.current[userId] = true;
    } catch {
      antdMessage.error('Unable to load conversation history.');
    } finally {
      setLoadingHistoryByUser((previous) => ({ ...previous, [userId]: false }));
    }
  };

  const openConversation = (userId: number) => {
    setSelectedConversationId(userId);
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.userId === userId
          ? { ...conversation, unreadCount: 0 }
          : conversation
      )
    );

    void loadConversationHistory(userId);
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversationId || !selectedConversation) {
      return;
    }

    const confirmDelete = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: 'Delete conversation?',
        content: (
          <div>
            <p>
              This will remove your chat with <strong>{selectedConversation.userName}</strong>.
            </p>
            <Text type="secondary">This action cannot be undone from your side.</Text>
          </div>
        ),
        okText: 'Delete',
        okButtonProps: { danger: true },
        cancelText: 'Cancel',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

    if (!confirmDelete) {
      return;
    }

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      antdMessage.error('You are not authenticated.');
      return;
    }

    try {
      setDeletingConversationId(selectedConversationId);
      const res = await fetch(`${API_BASE}/messages/${selectedConversationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete conversation');
      }

      const deletedId = selectedConversationId;
      setConversations((previous) => previous.filter((conversation) => conversation.userId !== deletedId));
      setMessagesByUser((previous) => {
        const next = { ...previous };
        delete next[deletedId];
        return next;
      });
      delete loadedHistoryRef.current[deletedId];
      setSelectedConversationId(null);
      antdMessage.success('Conversation deleted.');
    } catch (err: any) {
      antdMessage.error(err?.message || 'Failed to delete conversation');
    } finally {
      setDeletingConversationId(null);
    }
  };

  const handleSendMessage = () => {
    if (!selectedConversationId) {
      return;
    }

    const trimmed = draftMessage.trim();
    if (!trimmed) {
      return;
    }

    if (!isConnected) {
      antdMessage.error('Not connected to server');
      return;
    }

    sendMessage(selectedConversationId, trimmed);

    const outgoingTimestamp = new Date().toISOString();
    const outgoing: MessageItem = {
      id: `${Date.now()}-${Math.random()}`,
      senderId: currentUserId ?? 0,
      recipientId: selectedConversationId,
      text: trimmed,
      timestamp: outgoingTimestamp,
      isMine: true,
    };

    setMessagesByUser((previous) => ({
      ...previous,
      [selectedConversationId]: [...(previous[selectedConversationId] ?? []), outgoing],
    }));
    loadedHistoryRef.current[selectedConversationId] = true;

    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.userId === selectedConversationId
          ? {
              ...conversation,
              preview: `You: ${trimmed}`,
              updatedAt: outgoingTimestamp,
            }
          : conversation
      )
    );

    setDraftMessage('');
  };

  return (
    <div style={{ padding: isMobile ? 8 : 12, overflow: 'hidden', height: '100%' }}>
      <div style={{ width: '100%', margin: '0', height: '100%', overflow: 'hidden' }}>
        <Card
          title={
            <Space>
              <Title level={4} style={{ margin: 0 }}>Messages</Title>
              {isConnected ? <Badge status="success" text="Connected" /> : <Badge status="error" text="Disconnected" />}
            </Space>
          }
          style={{ borderRadius: 12, height: isMobile ? 'calc(100vh - 190px)' : 'calc(100vh - 220px)' }}
          styles={{ body: { height: '100%', padding: 12, overflow: 'hidden' } }}
        >
          <div style={{ display: 'flex', height: '100%', gap: 12, minHeight: 0, overflow: 'hidden' }}>
            <div
              style={{
                width: isMobile ? '100%' : '32%',
                display: isMobile && selectedConversationId ? 'none' : 'flex',
                flexDirection: 'column',
                minWidth: 0,
                minHeight: 0,
                overflow: 'hidden',
                background: '#f7f8fa',
                borderRadius: 10,
                border: '1px solid #eceff3',
                padding: 10,
              }}
            >
              <Text strong style={{ marginBottom: 10, fontSize: 16 }}>Chats</Text>
              <Input
                placeholder="Search people or messages"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                style={{ marginBottom: 12, borderRadius: 10 }}
              />

              {loadingContacts ? (
                <Text type="secondary">Loading conversations...</Text>
              ) : filteredConversations.length === 0 ? (
                <Empty description={<Text type="secondary">No conversation found.</Text>} />
              ) : (
                <List
                  dataSource={filteredConversations}
                  style={{ paddingRight: 4, flex: 1, minHeight: 0 }}
                  renderItem={(conversation) => (
                    <List.Item
                      onClick={() => openConversation(conversation.userId)}
                      style={{
                        cursor: 'pointer',
                        border: '1px solid #dde2ea',
                        borderRadius: 12,
                        marginBottom: 8,
                        padding: '10px 12px',
                        background: selectedConversationId === conversation.userId ? '#e9f2ff' : '#ffffff',
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar size={46} style={{ background: '#e7e7e7', color: '#000', fontWeight: 700 }}>
                            {getAvatarLabel(conversation.userName)}
                          </Avatar>
                        }
                        title={
                          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Text strong style={{ fontSize: 20, lineHeight: 1.1 }}>
                              {conversation.userName}
                            </Text>
                            <Space size={6}>
                              {conversation.unreadCount > 0 && <Badge count={conversation.unreadCount} />}
                              {formatTime(conversation.updatedAt) ? (
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {formatTime(conversation.updatedAt)}
                                </Text>
                              ) : null}
                            </Space>
                          </Space>
                        }
                        description={<Text style={{ color: '#5a6372' }}>{conversation.preview}</Text>}
                      />
                    </List.Item>
                  )}
                />
              )}
            </div>

            <div
              style={{
                width: isMobile ? '100%' : '68%',
                display: isMobile && !selectedConversationId ? 'none' : 'flex',
                flexDirection: 'column',
                minWidth: 0,
                minHeight: 0,
                overflow: 'hidden',
                border: '1px solid #d9deea',
                borderRadius: 12,
                background: '#f4f7fc',
              }}
            >
              {!selectedConversation ? (
                <div style={{ margin: 'auto' }}>
                  <Empty description="Select a conversation to start chatting" />
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderBottom: '1px solid #d9deea',
                      background: '#0f355d',
                      color: '#fff',
                    }}
                  >
                    {isMobile ? (
                      <Button
                        type="text"
                        icon={<ArrowLeftOutlined />}
                        onClick={() => setSelectedConversationId(null)}
                        style={{ color: '#fff' }}
                      />
                    ) : null}
                    <Avatar size={40} style={{ background: '#e7e7e7', color: '#000', fontWeight: 700 }}>
                      {getAvatarLabel(selectedConversation.userName)}
                    </Avatar>
                    <div style={{ minWidth: 0 }}>
                      <Text strong style={{ display: 'block', color: '#fff' }}>
                        {selectedConversation.userName}
                      </Text>
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                        {isConnected ? 'Active now' : 'Offline'}
                      </Text>
                    </div>
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={handleDeleteConversation}
                      loading={deletingConversationId === selectedConversation.userId}
                      style={{ marginLeft: 'auto' }}
                    >
                      Delete Conversation
                    </Button>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    {loadingHistoryByUser[selectedConversation.userId] ? (
                      <Text type="secondary" style={{ textAlign: 'center', marginTop: 20 }}>
                        Loading messages...
                      </Text>
                    ) : selectedMessages.length === 0 ? (
                      <Text type="secondary" style={{ textAlign: 'center', marginTop: 20 }}>
                        No messages yet. Say hello 👋
                      </Text>
                    ) : (
                      selectedMessages.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            justifyContent: item.isMine ? 'flex-end' : 'flex-start',
                          }}
                        >
                          <div
                            style={{
                              maxWidth: '75%',
                              padding: '9px 12px',
                              borderRadius: 16,
                              background: item.isMine ? '#1681ff' : '#ffffff',
                              border: item.isMine ? 'none' : '1px solid #e2e8f0',
                              boxShadow: item.isMine ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.06)',
                            }}
                          >
                            <Text style={{ color: item.isMine ? '#fff' : '#111' }}>{item.text}</Text>
                            <div style={{ marginTop: 4 }}>
                              <Text style={{ fontSize: 11, color: item.isMine ? 'rgba(255,255,255,0.8)' : '#666' }}>
                                {formatTime(item.timestamp)}
                              </Text>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <Space.Compact style={{ width: '100%', padding: 12, borderTop: '1px solid #d9deea', background: '#fff' }}>
                    <Input
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      onPressEnter={handleSendMessage}
                      placeholder="Type a message"
                      disabled={!isConnected}
                    />
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={handleSendMessage}
                      disabled={!isConnected || !draftMessage.trim()}
                    >
                      Send
                    </Button>
                  </Space.Compact>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Messages;
