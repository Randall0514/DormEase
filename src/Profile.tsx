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
  Grid,
} from 'antd';
import {
  UserOutlined,
  SafetyOutlined,
  EditOutlined,
  MailOutlined,
  LogoutOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const Profile: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
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
  
  // OTP verification states
  const [showPasswordOtpModal, setShowPasswordOtpModal] = useState(false);
  const [showEmailOtpModal, setShowEmailOtpModal] = useState(false);
  const [otpModalForm] = Form.useForm();
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [currentOtpAction, setCurrentOtpAction] = useState<'password' | 'email'>('password');
  const [passwordOtpVerified, setPasswordOtpVerified] = useState(false);
  const [emailOtpVerified, setEmailOtpVerified] = useState(false);

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

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Clear forms when opening security section
  useEffect(() => {
    if (section === 'security') {
      passForm.resetFields();
      emailForm.resetFields();
      // Delay to ensure React has rendered the inputs
      setTimeout(() => {
        const emailInputs = document.querySelectorAll('input[type="email"], input[name="email"]');
        const passwordInputs = document.querySelectorAll('input[type="password"], input[name="password"]');
        emailInputs.forEach((input: any) => { input.value = ''; });
        passwordInputs.forEach((input: any) => { input.value = ''; });
      }, 100);
    }
  }, [section, passForm, emailForm]);

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

  const handleRequestOtp = async () => {
    try {
      setSendingOtp(true);
      const token = localStorage.getItem('dormease_token');
      const response = await fetch('http://localhost:3000/auth/request-change-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to send OTP');
      }

      setOtpSent(true);
      setCountdown(60);
      message.success('OTP sent to your email!');
    } catch (error: any) {
      message.error(error.message || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (values: { otp: string }) => {
    try {
      setVerifyingOtp(true);
      const token = localStorage.getItem('dormease_token');
      const response = await fetch('http://localhost:3000/auth/verify-change-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ otp: values.otp }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Invalid OTP');
      }

      setOtpVerified(true);
      if (currentOtpAction === 'password') {
        setPasswordOtpVerified(true);
      } else {
        setEmailOtpVerified(true);
      }
      message.success('OTP verified! You can now change your ' + (currentOtpAction === 'password' ? 'password' : 'email'));
    } catch (error: any) {
      message.error(error.message || 'OTP verification failed');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleCloseOtpModal = () => {
    setShowPasswordOtpModal(false);
    setShowEmailOtpModal(false);
    setOtpSent(false);
    setOtpVerified(false);
    otpModalForm.resetFields();
    setCountdown(0);
  };

  const handlePasswordChangeClick = async () => {
    try {
      // Validate form first
      await passForm.validateFields();
      setCurrentOtpAction('password');
      setPasswordOtpVerified(false);
      setShowPasswordOtpModal(true);
    } catch (error) {
      // Validation failed, errors are shown by antd
    }
  };

  const handleEmailChangeClick = async () => {
    try {
      // Validate form first
      await emailForm.validateFields();
      setCurrentOtpAction('email');
      setEmailOtpVerified(false);
      setShowEmailOtpModal(true);
    } catch (error) {
      // Validation failed, errors are shown by antd
    }
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
    <div style={{ padding: isMobile ? 12 : 24, height: '100%', display: 'flex', flexDirection: 'column', background: '#f5f7fa', overflowX: 'hidden' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', flex: 1, overflowY: 'auto', overflowX: 'hidden', width: '100%' }}>
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
                    <Form form={passForm} layout="vertical" autoComplete="off" onFinish={async (vals) => {
                      if (!passwordOtpVerified) {
                        message.error('Please verify OTP before changing password');
                        return;
                      }
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
                        setPasswordOtpVerified(false);
                        handleCloseOtpModal();
                      } catch (e: any) {
                        message.error(e.message || 'Failed to change password');
                      }
                    }}>
                      <Form.Item name="currentPassword" label="Current password" rules={[{ required: true }]}>
                        <Input.Password 
                          autoComplete="off" 
                          data-lpignore="true" 
                          data-1p-ignore="true"
                          onFocus={(e) => { e.target.value = ''; }}
                        />
                      </Form.Item>
                      <Form.Item name="newPassword" label="New password" rules={[{ required: true, min: 6 }]}>
                        <Input.Password 
                          autoComplete="off" 
                          data-lpignore="true" 
                          data-1p-ignore="true"
                        />
                      </Form.Item>
                      <Form.Item name="confirm" label="Confirm new password" dependencies={["newPassword"]} rules={[{ required: true, message: 'Please confirm' }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('newPassword') === value) return Promise.resolve(); return Promise.reject(new Error('Passwords do not match')); } })]}>
                        <Input.Password 
                          autoComplete="off" 
                          data-lpignore="true" 
                          data-1p-ignore="true"
                        />
                      </Form.Item>
                      <Form.Item>
                        <Button 
                          type="primary" 
                          onClick={handlePasswordChangeClick}
                        >
                          Change password
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card type="inner" title="Change email">
                    <Form form={emailForm} layout="vertical" autoComplete="off" onFinish={async (vals) => {
                      if (!emailOtpVerified) {
                        message.error('Please verify OTP before changing email');
                        return;
                      }
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
                        setEmailOtpVerified(false);
                        handleCloseOtpModal();
                      } catch (e: any) {
                        message.error(e.message || 'Failed to update email');
                      }
                    }}>
                      <Form.Item name="email" label="New email" rules={[{ required: true, type: 'email' }]}>
                        <Input 
                          type="email" 
                          autoComplete="off" 
                          data-lpignore="true" 
                          data-1p-ignore="true"
                          spellCheck="false" 
                          onFocus={(e) => { e.currentTarget.value = ''; }}
                        />
                      </Form.Item>
                      <Form.Item name="password" label="Current password" rules={[{ required: true }]}>
                        <Input.Password 
                          autoComplete="off" 
                          data-lpignore="true" 
                          data-1p-ignore="true"
                          onFocus={(e) => { e.target.value = ''; }}
                        />
                      </Form.Item>
                      <Form.Item>
                        <Button 
                          type="primary" 
                          onClick={handleEmailChangeClick}
                        >
                          Change email
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                </Col>
              </Row>
              </Card>
            )}
          </Col>
        </Row>

        {/* OTP Verification Modal */}
        <Modal 
          title={`Verify via OTP - ${currentOtpAction === 'password' ? 'Change Password' : 'Change Email'}`}
          open={showPasswordOtpModal || showEmailOtpModal}
          onCancel={handleCloseOtpModal}
          width={isMobile ? '95vw' : 450}
          footer={null}
        >
          {!otpVerified ? (
            <Form form={otpModalForm} layout="vertical" onFinish={handleVerifyOtp}>
              {!otpSent ? (
                <>
                  <Text style={{ display: 'block', marginBottom: 16 }}>
                    We'll send a verification code to your email address.
                  </Text>
                  <Button 
                    type="primary" 
                    block 
                    size="large"
                    loading={sendingOtp}
                    onClick={handleRequestOtp}
                  >
                    Request OTP
                  </Button>
                </>
              ) : (
                <>
                  <Text style={{ display: 'block', marginBottom: 16 }}>
                    Enter the 6-digit code sent to your email.
                  </Text>
                  <Form.Item 
                    name="otp" 
                    label="Enter OTP" 
                    rules={[{ required: true, message: 'Please enter OTP' }]}
                  >
                    <Input 
                      placeholder="000000" 
                      maxLength={6}
                      style={{ fontSize: 24, letterSpacing: 4, textAlign: 'center' }}
                    />
                  </Form.Item>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Button block onClick={handleCloseOtpModal}>
                      Cancel
                    </Button>
                    <Button 
                      type="primary" 
                      block
                      loading={verifyingOtp}
                      onClick={() => otpModalForm.submit()}
                    >
                      Verify OTP
                    </Button>
                  </Space>
                  <div style={{ textAlign: 'center', marginTop: 12 }}>
                    {countdown > 0 ? (
                      <Text type="secondary">Resend code in {countdown}s</Text>
                    ) : (
                      <Button 
                        type="link" 
                        onClick={handleRequestOtp}
                        loading={sendingOtp}
                      >
                        Resend OTP
                      </Button>
                    )}
                  </div>
                </>
              )}
            </Form>
          ) : (
            <div style={{ textAlign: 'center', paddingTop: 16 }}>
              <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 16 }}>
                ✓ OTP Verified Successfully!
              </Text>
              <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                You can now {currentOtpAction === 'password' ? 'change your password' : 'change your email'} below.
              </Text>
              <Button 
                type="primary" 
                block 
                size="large"
                onClick={() => {
                  if (currentOtpAction === 'password') {
                    passForm.submit();
                  } else {
                    emailForm.submit();
                  }
                }}
              >
                Proceed with {currentOtpAction === 'password' ? 'Password' : 'Email'} Change
              </Button>
            </div>
          )}
        </Modal>

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