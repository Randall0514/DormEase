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
  Divider,
  Spin,
  Badge,
  Tag,
} from 'antd';
import {
  UserOutlined,
  SafetyOutlined,
  EditOutlined,
  MailOutlined,
  PhoneOutlined,
  LogoutOutlined,
  LockOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

const Profile: React.FC = () => {
  const [user, setUser] = useState<{ id?: number; username?: string; email?: string; fullName?: string; platform?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const menuItems = [
    { key: 'personal', icon: <UserOutlined />, label: 'Personal Information', description: 'Manage your profile details' },
    { key: 'security', icon: <SafetyOutlined />, label: 'Login & Security', description: 'Update password and email' },
  ];

  const [section, setSection] = useState<'personal' | 'security'>('personal');
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm();
  const [passForm] = Form.useForm();
  const [emailForm] = Form.useForm();

  useEffect(() => {
    const token = localStorage.getItem('dormease_token');
    if (!token) {
      setLoading(false);
      return;
    }

    fetch('http://localhost:3000/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((data) => {
        setUser(data.user || null);
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
      });
  }, []);

  const handleLogout = async () => {
    const token = localStorage.getItem('dormease_token');
    try {
      await fetch('http://localhost:3000/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    localStorage.removeItem('dormease_token');
    message.success('Logged out successfully');
    window.location.href = '/';
  };

  const avatarLetter = user?.fullName?.charAt(0).toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || 'U';

  if (loading) {
    return (
      <div style={{ padding: 24, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="Loading profile..." />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', background: '#f5f7fa' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', flex: 1, overflowY: 'auto', width: '100%' }}>
        <Title level={2} style={{ marginBottom: 24 }}>Account Settings</Title>
        
        <Row gutter={24}>
          {/* Left Sidebar */}
          <Col xs={24} md={8}>
            <Card 
              style={{ borderRadius: 12, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              bodyStyle={{ padding: 24, textAlign: 'center' }}
            >
              <Badge.Ribbon text={user?.platform || 'web'} color="blue">
                <Avatar size={120} style={{ backgroundColor: '#4f73ff', fontSize: 48, marginBottom: 16 }}>
                  {avatarLetter}
                </Avatar>
              </Badge.Ribbon>
              <Title level={4} style={{ margin: '16px 0 4px' }}>
                {user?.fullName || 'User'}
              </Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>@{user?.username || 'username'}</Text>
              <Tag icon={<MailOutlined />} color="blue" style={{ marginBottom: 16 }}>{user?.email || 'email@example.com'}</Tag>
              
              <Divider style={{ margin: '16px 0' }} />
              
              <Button 
                type="primary" 
                icon={<EditOutlined />}
                block 
                size="large"
                style={{ marginBottom: 12 }}
                onClick={() => {
                  form.setFieldsValue({ fullName: user?.fullName, username: user?.username, email: user?.email, password: '' });
                  setEditing(true);
                }}
              >
                Edit Profile
              </Button>
              
              <Button 
                danger
                icon={<LogoutOutlined />}
                block
                size="large"
                onClick={handleLogout}
              >
                Logout
              </Button>
            </Card>

            <Card 
              style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              title={<Text strong>Navigation</Text>}
              bodyStyle={{ padding: 0 }}
            >
              <List
                dataSource={menuItems}
                renderItem={(item: any) => (
                  <List.Item 
                    style={{ 
                      padding: '16px 20px', 
                      cursor: 'pointer',
                      background: section === item.key ? '#f0f5ff' : 'transparent',
                      borderLeft: section === item.key ? '3px solid #4f73ff' : '3px solid transparent',
                      transition: 'all 0.3s ease'
                    }} 
                    onClick={() => setSection(item.key)}
                  >
                    <List.Item.Meta
                      avatar={
                        <div style={{ 
                          width: 40, 
                          height: 40, 
                          borderRadius: 10, 
                          background: section === item.key ? '#4f73ff' : '#f0f5ff', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          color: section === item.key ? '#fff' : '#4f73ff',
                          fontSize: 18
                        }}>
                          {item.icon}
                        </div>
                      }
                      title={<Text strong={section === item.key}>{item.label}</Text>}
                      description={<Text type="secondary" style={{ fontSize: 12 }}>{item.description}</Text>}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>

          {/* Right Content */}
          <Col xs={24} md={16}>
            {/* Personal Information Section */}
            {section === 'personal' && (
              <Card 
                title={
                  <Space>
                    <UserOutlined style={{ color: '#4f73ff', fontSize: 20 }} />
                    <Text strong style={{ fontSize: 18 }}>Personal Information</Text>
                  </Space>
                }
                style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              >
                <Descriptions column={1} bordered size="middle">
                  <Descriptions.Item label="Full Name">
                    <Text strong>{user?.fullName || '-'}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Username">
                    <Text>{user?.username || '-'}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Email Address">
                    <Space>
                      <MailOutlined style={{ color: '#4f73ff' }} />
                      <Text>{user?.email || '-'}</Text>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="Platform">
                    <Tag color="blue">{user?.platform || 'web'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Account Status">
                    <Tag icon={<CheckCircleOutlined />} color="success">Active</Tag>
                  </Descriptions.Item>
                </Descriptions>

                <Divider />

                <Text type="secondary" style={{ fontSize: 12 }}>
                  Last updated: {new Date().toLocaleDateString()}
                </Text>
              </Card>
            )}

            {/* Security Section */}
            {section === 'security' && (
              <Card 
                title={
                  <Space>
                    <SafetyOutlined style={{ color: '#4f73ff', fontSize: 20 }} />
                    <Text strong style={{ fontSize: 18 }}>Login & Security</Text>
                  </Space>
                }
                style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              >
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Card type="inner" title="Change password">
                    <Form form={passForm} layout="vertical" onFinish={async (vals) => {
                      const { currentPassword, newPassword, confirm } = vals;
                      if (!user) return message.error('No user');
                      if (!currentPassword || !newPassword) return message.error('Please fill fields');
                      if (newPassword !== confirm) return message.error('Passwords do not match');
                      try {
                        // verify current password by attempting login
                        const loginRes = await fetch('http://localhost:3000/auth/login', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ identifier: user.email || user.username, password: currentPassword, platform: user.platform || 'web' })
                        });
                        if (!loginRes.ok) return message.error('Current password incorrect');

                        const token = localStorage.getItem('dormease_token');
                        const patch = await fetch('http://localhost:3000/auth/me', {
                          method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ password: newPassword })
                        });
                        if (!patch.ok) {
                          const err = await patch.json().catch(() => ({}));
                          throw new Error(err.message || 'Failed to update password');
                        }
                        message.success('Password updated');
                        passForm.resetFields();
                      } catch (e: any) {
                        message.error(e.message || 'Failed to change password');
                      }
                    }}>
                      <Form.Item name="currentPassword" label="Current password" rules={[{ required: true }]}>
                        <Input.Password />
                      </Form.Item>
                      <Form.Item name="newPassword" label="New password" rules={[{ required: true, min: 6 }]}>
                        <Input.Password />
                      </Form.Item>
                      <Form.Item name="confirm" label="Confirm new password" dependencies={["newPassword"]} rules={[{ required: true, message: 'Please confirm' }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('newPassword') === value) return Promise.resolve(); return Promise.reject(new Error('Passwords do not match')); } })]}>
                        <Input.Password />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" onClick={() => passForm.submit()}>Change password</Button>
                      </Form.Item>
                    </Form>
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card type="inner" title="Change email">
                    <Form form={emailForm} layout="vertical" onFinish={async (vals) => {
                      const { email, password } = vals;
                      if (!user) return message.error('No user');
                      if (!email || !password) return message.error('Please fill fields');
                      try {
                        // verify password
                        const loginRes = await fetch('http://localhost:3000/auth/login', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ identifier: user.email || user.username, password, platform: user.platform || 'web' })
                        });
                        if (!loginRes.ok) return message.error('Password incorrect');

                        const token = localStorage.getItem('dormease_token');
                        const patch = await fetch('http://localhost:3000/auth/me', {
                          method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ email })
                        });
                        if (!patch.ok) {
                          const err = await patch.json().catch(() => ({}));
                          throw new Error(err.message || 'Failed to update email');
                        }
                        const data = await patch.json();
                        setUser(data.user || null);
                        message.success('Email updated');
                        emailForm.resetFields();
                      } catch (e: any) {
                        message.error(e.message || 'Failed to update email');
                      }
                    }}>
                      <Form.Item name="email" label="New email" rules={[{ required: true, type: 'email' }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item name="password" label="Current password" rules={[{ required: true }]}>
                        <Input.Password />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" onClick={() => emailForm.submit()}>Change email</Button>
                      </Form.Item>
                    </Form>
                  </Card>
                </Col>
              </Row>
              </Card>
            )}
          </Col>
        </Row>

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
      </div>
    </div>
  );
};

export default Profile;