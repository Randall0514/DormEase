import React from 'react';
import { Card, Typography, Empty } from 'antd';

const { Title, Text } = Typography;

type Props = {
  onNavigate?: (section: string) => void;
};

const Messages: React.FC<Props> = () => {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <Card
          title={<Title level={4} style={{ margin: 0 }}>Messages</Title>}
          style={{ borderRadius: 12 }}
        >
          <Empty
            description={
              <Text type="secondary">No messages yet.</Text>
            }
          />
        </Card>
      </div>
    </div>
  );
};

export default Messages;
