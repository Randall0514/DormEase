import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { message as antdMessage } from 'antd';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  sendMessage: (recipientId: number, message: string) => void;
  onNewMessage: (callback: (data: any) => void) => void;
  onNotification: (callback: (data: any) => void) => void;
  offNewMessage: (callback: (data: any) => void) => void;
  offNotification: (callback: (data: any) => void) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

const SOCKET_URL = 'http://localhost:3000';
const AUTH_TOKEN_KEY = 'dormease_token';

interface Props {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<Props> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    
    if (!token) {
      console.log('⚠️ No auth token, skipping WebSocket connection');
      return;
    }

    // Initialize Socket.IO client
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
      antdMessage.success('Connected to real-time updates', 2);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('🔴 WebSocket connection error:', error.message);
      setIsConnected(false);
    });

    newSocket.on('error', (error) => {
      console.error('🔴 WebSocket error:', error);
      antdMessage.error(error.message || 'WebSocket error occurred');
    });

    // Handle reconnection
    newSocket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
      antdMessage.info('Reconnected to server', 2);
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Failed to reconnect to server');
      antdMessage.error('Failed to reconnect. Please refresh the page.');
    });

    setSocket(newSocket);

    return () => {
      console.log('🔌 Cleaning up WebSocket connection');
      newSocket.close();
    };
  }, []);

  const sendMessage = useCallback(
    (recipientId: number, message: string) => {
      if (socket && isConnected) {
        socket.emit('send_message', { recipientId, message });
      } else {
        antdMessage.error('Not connected to server');
      }
    },
    [socket, isConnected]
  );

  const onNewMessage = useCallback(
    (callback: (data: any) => void) => {
      if (socket) {
        socket.on('new_message', callback);
      }
    },
    [socket]
  );

  const onNotification = useCallback(
    (callback: (data: any) => void) => {
      if (socket) {
        socket.on('notification', callback);
        socket.on('reservation_updated', callback);
      }
    },
    [socket]
  );

  const offNewMessage = useCallback(
    (callback: (data: any) => void) => {
      if (socket) {
        socket.off('new_message', callback);
      }
    },
    [socket]
  );

  const offNotification = useCallback(
    (callback: (data: any) => void) => {
      if (socket) {
        socket.off('notification', callback);
        socket.off('reservation_updated', callback);
      }
    },
    [socket]
  );

  const value: WebSocketContextType = {
    socket,
    isConnected,
    sendMessage,
    onNewMessage,
    onNotification,
    offNewMessage,
    offNotification,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export default WebSocketContext;
