import React from 'react';
import {
  Avatar,
  Card,
  Typography,
  Space,
  Button,
  List,
  Row,
  Col,
} from 'antd';
import {
  UserOutlined,
  SafetyOutlined,
  LockOutlined,
  CreditCardOutlined,
  RightOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

const Profile: React.FC = () => {
  const menuItems = [
    { icon: <UserOutlined />, label: 'Personal Information' },
    { icon: <SafetyOutlined />, label: 'Login & security' },
    { icon: <LockOutlined />, label: 'Privacy' },
    { icon: <CreditCardOutlined />, label: 'Payment' },
  ];

  const recentDorms = [
    { name: 'Bodomy dorm', price: '4444', period: 'month' },
    { name: 'Randall dorm', price: '6767', period: 'month' },
    { name: 'Mayshang dorm', price: '5000', period: 'month' },
    { name: 'Lehron dorm', price: '4000', period: 'month' },
  ];

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', flex: 1, overflowY: 'auto', paddingRight: 12 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12 }}>
            <Row gutter={16} align="middle">
              <Col>
                <Avatar size={88} style={{ backgroundColor: '#4f73ff' }}>
                  R
                </Avatar>
              </Col>
              <Col flex="auto">
                <Title level={4} style={{ margin: 0 }}>
                  Randall
                </Title>
                <Text type="secondary">User</Text>

                <div style={{ marginTop: 16 }}>
                  <List
                    itemLayout="horizontal"
                    dataSource={menuItems}
                    renderItem={(item) => (
                      <List.Item style={{ padding: '8px 0' }}>
                        <List.Item.Meta
                          avatar={<div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0f5ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</div>}
                          title={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span>{item.label}</span>
                            <RightOutlined style={{ color: '#bfc9e6' }} />
                          </div>}
                        />
                      </List.Item>
                    )}
                  />
                </div>
              </Col>

              <Col>
                <Card style={{ background: 'linear-gradient(180deg,#4f73ff 0%,#79acff 100%)', color: '#fff', borderRadius: 12 }} bodyStyle={{ padding: 12 }}>
                  <Title level={5} style={{ color: '#fff', margin: 0 }}>Become a Host/Owner</Title>
                  <Text style={{ color: 'rgba(255,255,255,0.9)' }}>If you have your own dorm, you can start a business here and earn extra income</Text>
                  <div style={{ marginTop: 12 }}>
                    <Button type="default" style={{ borderRadius: 999, background: '#fff' }}>Start now!</Button>
                  </div>
                </Card>
              </Col>
            </Row>
          </Card>

          <Card style={{ borderRadius: 12 }} title={<Title level={4} style={{ margin: 0 }}>Recently Checked Dorms</Title>}>
            <List
              grid={{ gutter: 16, column: 2 }}
              dataSource={recentDorms}
              renderItem={(dorm) => (
                <List.Item>
                  <Card hoverable style={{ width: '100%', borderRadius: 12 }}>
                    <Row gutter={12} align="middle">
                      <Col>
                        <div style={{ width: 64, height: 64, background: '#f0f2f5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Photo</div>
                      </Col>
                      <Col flex="auto">
                        <Title level={5} style={{ margin: 0 }}>{dorm.name}</Title>
                        <Text type="secondary"><span style={{ fontWeight: 600, fontSize: 16 }}>{dorm.price}</span>/{dorm.period}</Text>
                      </Col>
                    </Row>
                  </Card>
                </List.Item>
              )}
            />
          </Card>
        </Space>
      </div>
    </div>
  );
};

export default Profile;