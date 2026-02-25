import React, { useState, useEffect, useRef } from 'react';
import {
  Layout,
  Typography,
  Badge,
  Avatar,
  Dropdown,
  Row,
  Col,
  Card,
  Space,
  Button,
  Tag,
  Input,
  Modal,
  Form,
  Select,
  Upload,
  message,
  Carousel,
  Checkbox,
} from 'antd';
import type { UploadFile } from 'antd';
import { BellOutlined, UserOutlined, InboxOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import Sidebar, { type SectionKey } from './Sidebar';
import Profile from './Profile';
import Settings from './Settings';
import Notifications from './Notifications';
import ArchivedNotifications from './ArchivedNotifications';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const AUTH_TOKEN_KEY = 'dormease_token';
const API_BASE = 'http://localhost:3000';

interface AccountInfo {
  isNew?: boolean;
}

interface DormData {
  id: number;
  dorm_name: string;
  email: string;
  phone: string;
  price: string;
  address: string;
  deposit?: string | null;
  advance?: string | null;
  room_capacity: number;
  utilities?: string[] | null;
  photo_urls?: string[] | null;
}

interface DashboardProps {
  onLogout?: () => void;
  account?: AccountInfo;
  onSetupComplete?: () => void;
}

const { Dragger } = Upload;

const Dashboard: React.FC<DashboardProps> = ({ onLogout, account, onSetupComplete }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>('home');
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [setupForm] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [dorm, setDorm] = useState<DormData | null>(null);
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [thumbStart, setThumbStart] = useState(0);
  const carouselRef = useRef<any>(null);
  const carouselClickCooldown = useRef(0);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchDorm = () => {
    fetch(`${API_BASE}/dorms/me`, { headers: getAuthHeaders() })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setDorm(data.dorm || null))
      .catch(() => setDorm(null));
  };

  useEffect(() => {
    fetchDorm();
  }, []);

  // populate setup form with existing dorm data when available
  useEffect(() => {
    if (!dorm) return;
    setupForm.setFieldsValue({
      dormName: dorm.dorm_name,
      email: dorm.email,
      phone: dorm.phone,
      price: dorm.price,
      deposit: dorm.deposit || undefined,
      advance: dorm.advance || undefined,
      address: dorm.address,
      capacity: dorm.room_capacity,
      utilities: dorm.utilities || [],
    });

    // populate fileList with existing photos if not already set
    if (dorm.photo_urls && dorm.photo_urls.length > 0 && fileList.length === 0) {
      const existing = dorm.photo_urls.map((p, i) => ({
        uid: `existing-${i}`,
        name: `photo-${i}`,
        status: 'done' as const,
        url: API_BASE + p,
      }));
      setFileList(existing as UploadFile[]);
    }
  }, [dorm, setupForm]);

  useEffect(() => {
    setThumbStart(0);
  }, [dorm?.photo_urls?.length]);

  useEffect(() => {
    if (account?.isNew) setSetupModalOpen(true);
  }, [account?.isNew]);

  const handleSetupSubmit = async (values: Record<string, unknown>) => {
    if (fileList.length < 4) {
      message.error('Please upload at least 4 photos.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('dormName', String(values.dormName));
      formData.append('email', String(values.email));
      formData.append('phone', String(values.phone));
      formData.append('price', String(values.price));
      formData.append('deposit', String(values.deposit || ''));
      formData.append('advance', String(values.advance || ''));
      formData.append('address', String(values.address));
      formData.append('capacity', String(values.capacity));
      // utilities: array of keys
      formData.append('utilities', JSON.stringify(values.utilities || []));

      fileList.forEach((f) => {
        if (f.originFileObj) formData.append('photos', f.originFileObj);
      });

      const res = await fetch(`${API_BASE}/dorms`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save dorm');
      }
      const data = await res.json();
      setDorm(data.dorm);
      setSetupModalOpen(false);
      setupForm.resetFields();
      setFileList([]);
      onSetupComplete?.();
      message.success('Dorm saved.');
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Failed to save dorm');
    }
  };

  const setupModalContent = (
    <div style={{ background: '#e8f4fc', padding: 24, borderRadius: 12, margin: -24, marginBottom: 0 }}>
      <Title level={3} style={{ marginBottom: 24, fontWeight: 700 }}>Setup Your Dorm</Title>
      <Form
        form={setupForm}
        layout="vertical"
        onFinish={handleSetupSubmit}
        initialValues={{ phonePrefix: '+63', capacity: undefined }}
      >
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item name="dormName" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="Dorm Name" style={{ borderRadius: 8 }} size="large" />
            </Form.Item>
            <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Required' }]}>
              <Input placeholder="Your Email" style={{ borderRadius: 8 }} size="large" />
            </Form.Item>
            <Form.Item
              name="phone"
              rules={[{ required: true, message: 'Required' }, { pattern: /^\d{10}$/, message: 'Enter a 10-digit phone number' }]}
            >
              <Input addonBefore="+63" placeholder="Phone Number" style={{ borderRadius: 8 }} size="large" maxLength={10} inputMode="numeric" />
            </Form.Item>
            <Form.Item name="address" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="Address" style={{ borderRadius: 8 }} size="large" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="price" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="Price" style={{ borderRadius: 8 }} size="large" />
            </Form.Item>
            <Form.Item name="deposit">
              <Input placeholder="Deposit" style={{ borderRadius: 8 }} size="large" />
            </Form.Item>
            <Form.Item name="advance">
              <Input placeholder="Advance" style={{ borderRadius: 8 }} size="large" />
            </Form.Item>
            <Form.Item name="capacity" label="Room Capacity" rules={[{ required: true, message: 'Required' }]}>
              <Select placeholder="Room Capacity" style={{ borderRadius: 8 }} size="large" suffixIcon={<span style={{ fontSize: 12 }}>▼</span>} options={Array.from({ length: 10 }, (_, i) => i + 1).map((n) => ({ label: String(n), value: n }))} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Upload Photos (Minimum of 4)" name="photos">
          <Dragger multiple fileList={fileList} onChange={({ fileList: fl }) => setFileList(fl)} beforeUpload={() => false} style={{ borderRadius: 12, background: '#f5f5f5' }}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: '#999', fontSize: 48 }} />
            </p>
            <p className="ant-upload-text" style={{ color: '#999' }}>Drag & Drop or Click to Upload</p>
          </Dragger>
        </Form.Item>

        <Row gutter={16}>
          {[0, 1, 2, 3].map((i) => {
            const file = fileList[i];
            return (
              <Col span={6} key={i}>
                <div style={{ height: 72, background: '#e8e8e8', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 12, overflow: 'hidden' }}>
                  {file?.originFileObj && <img src={URL.createObjectURL(file.originFileObj)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  {!file && 'PHOTO'}
                </div>
              </Col>
            );
          })}
        </Row>

        <div style={{ marginTop: 24, padding: 16, background: '#ffffff', borderRadius: 8 }}>
          <Text style={{ fontWeight: 600, marginBottom: 16, display: 'block' }}>Utilities Included</Text>
          <Form.Item name="utilities" style={{ marginBottom: 0 }}>
            <Checkbox.Group
              options={[
                { label: 'WiFi', value: 'wifi' },
                { label: 'Bed Frame', value: 'bedFrame' },
                { label: 'Foam', value: 'foam' },
                { label: 'Kitchen', value: 'kitchen' },
                { label: 'Restroom', value: 'restroom' },
                { label: 'No Curfew', value: 'noCurfew' },
                { label: 'Visitors Allowed', value: 'visitorsAllowed' },
              ]}
            />
          </Form.Item>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
          <Button type="primary" htmlType="submit" size="large" style={{ borderRadius: 8, background: '#1e3a5f', borderColor: '#1e3a5f', fontWeight: 600, paddingLeft: 32, paddingRight: 32 }}>SUBMIT</Button>
        </div>
      </Form>
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case 'home':
        if (!dorm) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
              <div style={{ textAlign: 'center', background: '#f5fbff', padding: 32, borderRadius: 12, boxShadow: '0 6px 20px rgba(15,23,42,0.06)' }}>
                <Title level={3} style={{ marginBottom: 8 }}>You haven't set up your dorm yet</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Set up your dorm now to start receiving reservations and manage listings.</Text>
                <Button type="primary" size="large" onClick={() => setSetupModalOpen(true)} style={{ borderRadius: 8 }}>Set Up Your Dorm</Button>
              </div>
            </div>
          );
        }

        return (
          <div>
            <div style={{ background: '#e8f4fc', borderRadius: 16, padding: 24, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title level={3} style={{ margin: 0, fontWeight: 700 }}>{dorm.dorm_name.toUpperCase()}</Title>
                <div>
                  <Button style={{ marginRight: 8 }} onClick={() => setSetupModalOpen(true)}>Edit Details</Button>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                {(() => {
                  const totalPhotos = dorm.photo_urls?.length ?? 0;
                  const safeStart = totalPhotos > 2 ? Math.min(thumbStart, Math.max(0, totalPhotos - 2)) : 0;
                  const photosToShow = totalPhotos > 0 ? dorm.photo_urls!.slice(safeStart, Math.min(safeStart + 2, totalPhotos)) : [null, null];

                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {totalPhotos > 2 && (
                        <Button type="text" icon={<LeftOutlined />} disabled={safeStart === 0} onClick={() => setThumbStart(Math.max(0, safeStart - 2))} />
                      )}

                      <div style={{ display: 'flex', gap: 12, flex: 1, justifyContent: 'center' }}>
                        {photosToShow.map((photoUrl, idx) => {
                          const globalIndex = totalPhotos > 0 ? safeStart + idx : idx;
                          return (
                            <div key={globalIndex} role="button" tabIndex={0} onClick={() => { if (photoUrl) { setCarouselIndex(globalIndex); setCarouselOpen(true); } }} onKeyDown={(e) => { if (photoUrl && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setCarouselIndex(globalIndex); setCarouselOpen(true); } }} style={{ width: 420, height: 280, background: photoUrl ? 'transparent' : '#d0d0d0', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 12, overflow: 'hidden', cursor: photoUrl ? 'pointer' : 'default' }}>
                              {photoUrl ? <img src={API_BASE + photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} /> : 'PHOTO'}
                            </div>
                          );
                        })}
                      </div>

                      {totalPhotos > 2 && (
                        <Button type="text" icon={<RightOutlined />} disabled={safeStart + 2 >= totalPhotos} onClick={() => setThumbStart(Math.min(totalPhotos - 2, safeStart + 2))} />
                      )}
                    </div>
                  );
                })()}
              </div>

              <Row gutter={24}>
                <Col span={12}>
                  <div style={{ background: '#1e3a5f', color: '#fff', padding: '14px 20px', borderRadius: 12, fontWeight: 600, textAlign: 'center' }}>Occupied Beds: 0</div>
                </Col>
                <Col span={12}>
                  <div style={{ background: '#1e3a5f', color: '#fff', padding: '14px 20px', borderRadius: 12, fontWeight: 600, textAlign: 'center' }}>Unoccupied Beds: {dorm.room_capacity}</div>
                </Col>
              </Row>

              <Title level={5} style={{ marginBottom: 12, fontWeight: 700 }}>Upcoming Payments</Title>
              <Text type="secondary">No tenants yet.</Text>
              <div style={{ marginTop: 16 }}>
                <Text type="secondary"><strong>Contact:</strong> {dorm.email} · +63{dorm.phone} · {dorm.address} · ₱{dorm.price}/month</Text>
              </div>
            </div>
          </div>
        );

      case 'settings':
        return <Settings />;
      case 'notifications':
        return <Notifications onNavigate={setActiveSection} />;
      case 'archived':
        return <ArchivedNotifications onNavigate={setActiveSection} />;
      case 'profile':
        return <Profile />;
      default:
        return null;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', height: '100vh', overflow: 'hidden' }}>
      <Sidebar collapsed={collapsed} onCollapse={setCollapsed} activeSection={activeSection} onSectionChange={setActiveSection} />

      <Layout style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Header style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: 24, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)' }}>
          <Space size={16} style={{ display: 'flex', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>{activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}</Title>
            {!['home', 'settings', 'profile'].includes(activeSection) && (
              <Input.Search placeholder="Search dorms, owners, or locations" allowClear style={{ minWidth: 220, maxWidth: 360 }} onSearch={(value) => { console.log('Search:', value); }} />
            )}
          </Space>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge count={3}><BellOutlined style={{ fontSize: 20 }} /></Badge>
            <Dropdown trigger={["click"]} menu={{ items: [{ key: 'logout', label: 'Logout', onClick: () => { if (onLogout) onLogout(); } }] }}>
              <Avatar icon={<UserOutlined />} style={{ cursor: 'pointer' }} />
            </Dropdown>
          </div>
        </Header>

        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)', flex: 1, overflowY: 'auto' }}>
          {renderSection()}
        </Content>

        <Modal title={null} open={setupModalOpen} onCancel={() => setSetupModalOpen(false)} footer={null} width={640} closable={true} styles={{ body: { padding: 0 } }}>
          {setupModalContent}
        </Modal>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
