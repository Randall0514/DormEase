import React from 'react';
import { Card, Typography, Empty, Grid } from 'antd';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

type Props = {
  onNavigate?: (section: string) => void;
};

const Messages: React.FC<Props> = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  return (
    <div style={{ padding: isMobile ? 12 : 24, overflowX: 'hidden' }}>
      <div style={{ maxWidth: 980, width: '100%', margin: '0 auto' }}>
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
