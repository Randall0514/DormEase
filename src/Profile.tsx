import React, { useEffect, useState } from 'react';
import {
  Avatar,
  Card,
  Typography,
  Space,
  Button,
  List,
  Row,
  Col,
  Descriptions,
  Modal,
  Form,
  Input,
  message,
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
  const [user, setUser] = useState<{ id?: number; username?: string; email?: string; fullName?: string } | null>(null);

  const menuItems = [
    { icon: <UserOutlined />, label: 'Personal Information' },
    { icon: <SafetyOutlined />, label: 'Login & security' },
    { icon: <LockOutlined />, label: 'Privacy' },
    { icon: <CreditCardOutlined />, label: 'Payment' },
  ];

  const [showPersonal, setShowPersonal] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    const token = localStorage.getItem('dormease_token');
    if (!token) return;

    fetch('http://localhost:3000/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((data) => setUser(data.user || null))
      .catch(() => setUser(null));
  }, []);

  const avatarLetter = user?.fullName?.charAt(0).toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || 'U';

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', flex: 1, overflowY: 'auto', paddingRight: 12 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 12 }}>
            <Row gutter={16} align="middle">
              <Col>
                <Avatar size={88} style={{ backgroundColor: '#4f73ff' }}>
                  {avatarLetter}
                </Avatar>
              </Col>
              <Col flex="auto">
                <Title level={4} style={{ margin: 0 }}>
                  {user?.fullName || user?.username || 'User'}
                </Title>
                <Text type="secondary">{user ? `${user.username} • ${user.email}` : 'User'}</Text>

                <div style={{ marginTop: 16 }}>
                  <List
                    itemLayout="horizontal"
                    dataSource={menuItems}
                    renderItem={(item) => (
                      <List.Item style={{ padding: '8px 0', cursor: 'pointer' }} onClick={() => setShowPersonal(item.label === 'Personal Information')}>
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

              <Col xs={24} sm={8} lg={6}>
                {showPersonal && (
                  <Card style={{ borderRadius: 12, boxShadow: '0 6px 18px rgba(15,23,42,0.06)' }} bodyStyle={{ padding: 16 }}>
                    <Title level={5} style={{ margin: 0 }}>Account Details</Title>
                    <Text type="secondary">Manage your account information</Text>

                    <div style={{ marginTop: 12 }}>
                      <Descriptions column={1} size="small">
                        <Descriptions.Item label="Full name">{user?.fullName || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Username">{user?.username || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Email">{user?.email || '-'}</Descriptions.Item>
                      </Descriptions>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                      <Button type="primary" onClick={() => {
                        form.setFieldsValue({ fullName: user?.fullName, username: user?.username, email: user?.email, password: '' });
                        setEditing(true);
                      }}>Edit Profile</Button>
                    </div>
                  </Card>
                )}
              </Col>
            </Row>
          </Card>
          {/** Edit modal for personal information */}
          <Modal title="Edit Profile" open={editing} onCancel={() => setEditing(false)} onOk={() => form.submit()} okText="Save">
            <Form form={form} layout="vertical" onFinish={async (vals) => {
              try {
                const token = localStorage.getItem('dormease_token');
                const res = await fetch('http://localhost:3000/auth/me', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify(vals),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  throw new Error(err.message || 'Failed to update');
                }
                const data = await res.json();
                setUser(data.user || null);
                message.success('Profile updated');
                setEditing(false);
              } catch (e: any) {
                message.error(e.message || 'Update failed');
              }
            }}>
              <Form.Item name="fullName" label="Full name" rules={[{ required: true, message: 'Please enter full name' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="username" label="Username" rules={[{ required: true, message: 'Please enter username' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="password" label="New password" extra="Leave blank to keep current password">
                <Input.Password />
              </Form.Item>
            </Form>
          </Modal>
        </Space>
      </div>
    </div>
  );
};

export default Profile;