import React from 'react';
import { Card, List, Tag, Typography, Row, Col, Space } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const Notifications: React.FC = () => {
  const notifications = [
    {
      type: 'Message',
      text: "Hello Jhia is the owner of Randall's dorm, you are welcome to check out the place.",
      date: '30 Jan 2026 at 8:30 AM',
      color: 'blue',
    },
    {
      type: 'Deals',
      text: "The Place that you've bookmarked is now on discount!",
      date: '20 Dec 2025 at 8:30 AM',
      color: 'orange',
    },
    {
      type: 'Message',
      text: "This is the owner of D7 dorm, thanks for messaging us.",
      date: '13 Oct 2024 at 11:00 AM',
      color: 'blue',
    },
    {
      type: 'Message',
      text: "Hello this is the owner of Mayshang dorm, you can contact me in this number ••••••••••.",
      date: '8 Aug 2024 at 1:30 PM',
      color: 'blue',
    },
    {
      type: 'Deals',
      text: "There's a huge discount happening book now!",
      date: '18 Jul 2024 at 10:30 AM',
      color: 'orange',
    },
    {
      type: 'Deals',
      text: "There's a huge discount happening book now!",
      date: '24 Mar 2024 at 7:30 AM',
      color: 'orange',
    },
    {
      type: 'Message',
      text: "Yo yo yo this is the owner of Salvador's dorm and I agree to meet up in person.",
      date: '17 Jan 2007 at 07:47 AM',
      color: 'blue',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <Card title={<Title level={4} style={{ margin: 0 }}>Notifications</Title>} style={{ borderRadius: 12 }}>
          <List
            dataSource={notifications}
            split={false}
            renderItem={(item) => (
              <List.Item>
                <Card hoverable style={{ width: '100%', borderRadius: 12, border: '1px solid #e9f1ff' }}>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Tag color={item.color === 'blue' ? 'processing' : 'orange'}>{item.type}</Tag>
                      </Col>
                      <Col>
                        <Text type="secondary"><ClockCircleOutlined style={{ marginRight: 8 }} />{item.date}</Text>
                      </Col>
                    </Row>

                    <div>
                      <Text>{item.text}</Text>
                    </div>
                  </Space>
                </Card>
              </List.Item>
            )}
          />
        </Card>
      </div>
    </div>
  );
};

export default Notifications;