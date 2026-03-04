import React, { useState, useEffect, useRef } from 'react';
import {
  Layout,
  Typography,
  Grid,
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
  Alert,
  Collapse,
} from 'antd';
import type { UploadFile } from 'antd';
import type { MenuProps } from 'antd';
import { BellOutlined, UserOutlined, InboxOutlined, LeftOutlined, RightOutlined, CheckOutlined, CloseOutlined, MenuOutlined } from '@ant-design/icons';
import Sidebar, { type SectionKey } from './Sidebar';
import Profile from './Profile';
import Settings from './Settings';
import Messages from './Messages';
import Notifications from './Notifications';
import ArchivedNotifications from './ArchivedNotifications';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

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

interface Reservation {
  id: number;
  dorm_name: string;
  location: string;
  full_name: string;
  phone: string;
  move_in_date: string;
  duration_months: number;
  price_per_month: number;
  deposit: number;
  advance: number;
  total_amount: number;
  notes: string;
  payment_method: string;
  status: string;
  created_at: string;
  tenant_action?: string | null; // 'accepted' | 'cancelled' | NULL
  tenant_action_at?: string | null; // when the tenant acted
  cancel_reason?: string | null;  // filled when tenant cancels
  rejection_reason?: string | null;  // filled when owner rejects
  termination_reason?: string | null;  // filled when owner terminates
  room_capacity?: number;
  dorm_id?: number;
  payments_paid?: number; // Number of payments marked as paid
}

interface DashboardProps {
  onLogout?: () => void;
  account?: AccountInfo;
  onSetupComplete?: () => void;
}

const { Dragger } = Upload;

const Dashboard: React.FC<DashboardProps> = ({ onLogout, account, onSetupComplete }) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [collapsed, setCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>('home');
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [setupForm] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [dorm, setDorm] = useState<DormData | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState<Reservation[]>([]);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [terminatingTenantId, setTerminatingTenantId] = useState<number | null>(null);
  const [acceptedTenants, setAcceptedTenants] = useState<Reservation[]>([]);
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [thumbStart, setThumbStart] = useState(0);
  const carouselRef = useRef<any>(null);
  const carouselClickCooldown = useRef(0);

  useEffect(() => {
    if (isMobile) {
      setCollapsed(true);
    }
  }, [isMobile]);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const getOccupiedBeds = (dorm_id?: number) => {
    if (!dorm_id) return 0;
    return notifications.filter(r => 
      r.dorm_id === dorm_id && 
      r.status === 'approved' && 
      r.tenant_action === 'accepted'
    ).length;
  };

  // Parse date string in DD/MM/YYYY format to Date object
  const parseDate = (dateStr: string): Date => {
    // Handle both DD/MM/YYYY and YYYY-MM-DD formats
    if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/').map(Number);
      return new Date(year, month - 1, day);
    } else if (dateStr.includes('-')) {
      // ISO format YYYY-MM-DD
      return new Date(dateStr);
    }
    // Fallback to default parsing
    return new Date(dateStr);
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const printPaymentReceipt = (tenant: Reservation, paymentNumber: number, paymentDate: Date) => {
    const receiptWindow = window.open('', '_blank', 'width=820,height=920');
    if (!receiptWindow) {
      message.error('Please allow popups to print the receipt.');
      return;
    }

    const issuedAt = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const dueDate = paymentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const dormName = dorm?.dorm_name || tenant.dorm_name || 'N/A';
    const dormAddress = dorm?.address || tenant.location || 'N/A';
    const contactNumber = dorm?.phone ? `+63${dorm.phone}` : 'N/A';
    const emailAddress = dorm?.email || 'N/A';
    const ownerPrintedName = dorm?.dorm_name ? `${dorm.dorm_name} Owner` : 'Dorm Owner';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>DormEase Payment Receipt</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #0f172a; }
            .receipt { border: 1px solid #dbe2ea; border-radius: 12px; padding: 20px; }
            .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
            .logo-wrap { display: flex; align-items: center; gap: 12px; }
            .logo-mark { width: 46px; height: 46px; border-radius: 50%; background: #1e3a5f; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; }
            .logo-text { font-size: 14px; color: #334155; }
            .system-name { font-size: 16px; font-weight: 700; margin: 0 0 12px 0; }
            .title { font-size: 20px; font-weight: 700; color: #1e3a5f; margin: 0; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; margin-top: 10px; }
            .field { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #f8fafc; }
            .label { font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
            .value { font-size: 14px; font-weight: 600; color: #0f172a; }
            .full { grid-column: 1 / -1; }
            .signature-section { margin-top: 26px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
            .signature-box { text-align: center; }
            .signature-line { border-top: 1px solid #64748b; margin: 30px 20px 6px; }
            .signature-name { font-size: 13px; font-weight: 700; color: #0f172a; }
            .signature-caption { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; }
            .footer { margin-top: 16px; font-size: 12px; color: #64748b; text-align: center; }
            @media print {
              body { margin: 0; padding: 12px; }
              .receipt { border: 1px solid #cbd5e1; }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <div class="logo-wrap">
                <div class="logo-mark">DE</div>
                <div class="logo-text">DormEase Logo</div>
              </div>
              <h2 class="title">Payment Receipt</h2>
            </div>

            <p class="system-name">System name: DormEase – Dormitory, Management System</p>

            <div class="grid">
              <div class="field">
                <div class="label">Dormitory Name</div>
                <div class="value">${escapeHtml(dormName)}</div>
              </div>
              <div class="field">
                <div class="label">Date Issued</div>
                <div class="value">${escapeHtml(issuedAt)}</div>
              </div>
              <div class="field full">
                <div class="label">Dorm Address</div>
                <div class="value">${escapeHtml(dormAddress)}</div>
              </div>
              <div class="field">
                <div class="label">Contact Number</div>
                <div class="value">${escapeHtml(contactNumber)}</div>
              </div>
              <div class="field">
                <div class="label">Email Address</div>
                <div class="value">${escapeHtml(emailAddress)}</div>
              </div>
              <div class="field">
                <div class="label">Tenant Name</div>
                <div class="value">${escapeHtml(tenant.full_name)}</div>
              </div>
              <div class="field">
                <div class="label">Payment</div>
                <div class="value">Payment #${paymentNumber} (Paid)</div>
              </div>
              <div class="field">
                <div class="label">Due Date</div>
                <div class="value">${escapeHtml(dueDate)}</div>
              </div>
              <div class="field">
                <div class="label">Amount</div>
                <div class="value">₱${Number(tenant.price_per_month).toLocaleString()}</div>
              </div>
            </div>

            <div class="signature-section">
              <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-name">${escapeHtml(tenant.full_name)}</div>
                <div class="signature-caption">Tenant Signature Over Printed Name</div>
              </div>
              <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-name">${escapeHtml(ownerPrintedName)}</div>
                <div class="signature-caption">Owner Signature Over Printed Name</div>
              </div>
            </div>

            <div class="footer">DormEase Receipt • Keep this copy for your payment records</div>
          </div>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    receiptWindow.document.open();
    receiptWindow.document.write(html);
    receiptWindow.document.close();
  };

  const fetchNotifications = () => {
    fetch(`${API_BASE}/reservations`, { headers: getAuthHeaders() })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: Reservation[]) => {
        const pending = data.filter((r) => r.status === 'pending');
        setNotifications(pending);
        setNotificationCount(pending.length);
        
        // Fetch accepted tenants (approved reservations where tenant has accepted)
        const accepted = data.filter((r) => r.status === 'approved' && r.tenant_action === 'accepted');
        setAcceptedTenants(accepted);
      })
      .catch(() => {
        setNotifications([]);
        setAcceptedTenants([]);
        setNotificationCount(0);
      });
  };

  const fetchDorm = () => {
    fetch(`${API_BASE}/dorms/me`, { headers: getAuthHeaders() })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setDorm(data.dorm || null))
      .catch(() => setDorm(null));
  };

  const terminateTenant = async (id: number, tenantName: string) => {
    // Step 1: Get termination reason
    const reason = await new Promise<string | null>((resolve) => {
      let val = '';
      Modal.confirm({
        title: 'Termination reason',
        width: isMobile ? 360 : 800,
        content: (
          <div>
            <p>Please provide a reason for terminating {tenantName}:</p>
            <textarea
              onChange={(e: any) => {
                val = e.target.value;
              }}
              rows={6}
              style={{ width: '100%', padding: 8, height: 160 }}
              placeholder="Reason for termination"
            />
          </div>
        ),
        okText: 'Next',
        cancelText: 'Cancel',
        onOk: () => {
          resolve(val);
        },
        onCancel: () => {
          resolve(null);
        },
      });
    });

    if (reason === null) {
      return;
    }

    const trimmed = String(reason).trim();
    if (trimmed.length === 0) {
      message.error('Termination reason is required');
      return;
    }

    // Step 2: Confirm termination
    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: 'Confirm tenant termination',
        width: isMobile ? 360 : 800,
        content: (
          <div>
            <p>Do you really want to terminate {tenantName}?</p>
            <div style={{ background: '#f6f8fb', padding: 12, borderRadius: 6, maxHeight: 240, overflowY: 'auto', marginTop: 12 }}>
              <Text type="secondary">Reason:</Text>
              <div style={{ marginTop: 8, fontWeight: 500 }}>{trimmed}</div>
            </div>
          </div>
        ),
        okText: 'Yes, Terminate',
        cancelText: 'Cancel',
        okButtonProps: { danger: true },
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

    if (!confirmed) {
      return;
    }

    setTerminatingTenantId(id);
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    try {
      const res = await fetch(`${API_BASE}/reservations/${id}/archive`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ termination_reason: trimmed }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.message || 'Failed to terminate tenant');
      }
      message.success(`${tenantName} has been terminated.`);
      fetchNotifications();
    } catch (err: any) {
      message.error(err?.message || 'Failed to terminate tenant.');
    } finally {
      setTerminatingTenantId(null);
    }
  };

  const updateStatus = async (id: number, status: 'approved' | 'rejected') => {
    setUpdatingId(id);
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    try {
      let body: any = { status };
      if (status === 'rejected') {
        const reason = await new Promise<string | null>((resolve) => {
          let val = '';
          Modal.confirm({
            title: 'Reject reservation',
            width: isMobile ? 360 : 800,
            content: (
              <div>
                <p>Please provide a reason for rejecting this reservation:</p>
                <textarea onChange={(e: any) => { val = e.target.value; }} rows={6} style={{ width: '100%', padding: 8, height: 160 }} placeholder="Reason" />
              </div>
            ),
            okText: 'Next',
            cancelText: 'Cancel',
            onOk: () => { resolve(val); },
            onCancel: () => { resolve(null); },
          });
        });
        if (reason === null) {
          setUpdatingId(null);
          return;
        }
        const trimmed = String(reason).trim();
        if (trimmed.length === 0) {
          message.error('Rejection reason is required');
          setUpdatingId(null);
          return;
        }
        const confirm = await new Promise<boolean>((resolve) => {
          Modal.confirm({
            title: 'Are you sure?',
            width: isMobile ? 360 : 800,
            content: (
              <div>
                <p>You're about to reject this tenant with the following reason:</p>
                <div style={{ background: '#f6f8fb', padding: 12, borderRadius: 6, maxHeight: 240, overflowY: 'auto' }}>{trimmed}</div>
              </div>
            ),
            okText: 'Confirm Reject',
            cancelText: 'Cancel',
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
        if (!confirm) {
          setUpdatingId(null);
          return;
        }
        body.rejection_reason = trimmed;
      } else if (status === 'approved') {
        const reservation = notifications.find((r) => r.id === id);
        const currentOccupied = getOccupiedBeds(reservation?.dorm_id);
        const capacity = reservation?.room_capacity || 0;
        const spotsLeft = capacity - currentOccupied;
        
        // If dorm is full, show error and return
        if (spotsLeft <= 0) {
          message.error('This dorm is at full capacity. Cannot confirm this reservation.');
          setUpdatingId(null);
          return;
        }
        
        const isDormAtCapacity = spotsLeft <= 1;

        const confirm = await new Promise<boolean>((resolve) => {
          Modal.confirm({
            title: 'Confirm Booking',
            width: isMobile ? 360 : 600,
            content: (
              <div>
                {isDormAtCapacity && (
                  <Alert
                    message="⚠️ Dorm is Near Capacity"
                    description={
                      `After confirming this tenant, your dorm will have only ${spotsLeft - 1} spot left. Once this tenant accepts, your dorm will be full.`
                    }
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16, borderRadius: 8 }}
                  />
                )}
                <p>Are you sure you want to confirm this reservation?</p>
                <div style={{ background: '#f3fbff', padding: 12, borderRadius: 6, marginTop: 12 }}>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>{reservation?.full_name}</Text><br />
                    <Text type="secondary">{reservation?.dorm_name} · {reservation?.move_in_date}</Text>
                  </div>
                  <Text type="secondary">
                    ₱{Number(reservation?.total_amount).toLocaleString()} for {reservation?.duration_months} month(s)
                  </Text>
                  <br />
                  <Text type="secondary" style={{ marginTop: 8, display: 'block', fontSize: 12 }}>
                    Beds: {currentOccupied}/{capacity} occupied
                  </Text>
                </div>
              </div>
            ),
            okText: 'Confirm Booking',
            cancelText: 'Cancel',
            okType: 'primary',
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
        if (!confirm) {
          setUpdatingId(null);
          return;
        }
      }
      const res = await fetch(`${API_BASE}/reservations/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg = errBody?.message || 'Failed to update';
        throw new Error(msg);
      }
      message.success(
        status === 'approved' ? 'Booking confirmed!' : 'Booking rejected.'
      );
      fetchNotifications();
    } catch (err: any) {
      console.error('Update status error:', err);
      message.error(err?.message || 'Failed to update reservation status.');
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    fetchDorm();
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
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
    <div style={{ background: '#e8f4fc', padding: isMobile ? 16 : 24, borderRadius: 12, margin: -24, marginBottom: 0 }}>
      <Title level={3} style={{ marginBottom: 24, fontWeight: 700 }}>Setup Your Dorm</Title>
      <Form
        form={setupForm}
        layout="vertical"
        onFinish={handleSetupSubmit}
        initialValues={{ phonePrefix: '+63', capacity: undefined }}
      >
        <Row gutter={[16, 0]}>
          <Col xs={24} md={12}>
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
          <Col xs={24} md={12}>
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

        <Row gutter={[12, 12]}>
          {[0, 1, 2, 3].map((i) => {
            const file = fileList[i];
            return (
              <Col xs={12} sm={6} key={i}>
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
                { label: 'Water', value: 'water' },
                { label: 'Electricity', value: 'electricity' },
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
            <div style={{ background: '#e8f4fc', borderRadius: 16, padding: isMobile ? 14 : 24, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: 12, marginBottom: 16 }}>
                <Title level={3} style={{ margin: 0, fontWeight: 700 }}>{dorm.dorm_name.toUpperCase()}</Title>
                <div>
                  <Button style={{ marginRight: isMobile ? 0 : 8 }} onClick={() => setSetupModalOpen(true)}>Edit Details</Button>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                {(() => {
                  const totalPhotos = dorm.photo_urls?.length ?? 0;
                  const safeStart = totalPhotos > 2 ? Math.min(thumbStart, Math.max(0, totalPhotos - 2)) : 0;
                  const photosToShow = totalPhotos > 0 ? dorm.photo_urls!.slice(safeStart, Math.min(safeStart + 2, totalPhotos)) : [null, null];

                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isMobile ? 'column' : 'row' }}>
                      {totalPhotos > 2 && (
                        <Button type="text" icon={<LeftOutlined />} disabled={safeStart === 0} onClick={() => setThumbStart(Math.max(0, safeStart - 2))} />
                      )}

                      <div style={{ display: 'flex', gap: 12, flex: 1, justifyContent: 'center', width: '100%', flexDirection: isMobile ? 'column' : 'row' }}>
                        {photosToShow.map((photoUrl, idx) => {
                          const globalIndex = totalPhotos > 0 ? safeStart + idx : idx;
                          return (
                            <div key={globalIndex} role="button" tabIndex={0} onClick={() => { if (photoUrl) { setCarouselIndex(globalIndex); setCarouselOpen(true); } }} onKeyDown={(e) => { if (photoUrl && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setCarouselIndex(globalIndex); setCarouselOpen(true); } }} style={{ width: '100%', maxWidth: 420, height: isMobile ? 200 : 280, background: photoUrl ? 'transparent' : '#d0d0d0', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 12, overflow: 'hidden', cursor: photoUrl ? 'pointer' : 'default' }}>
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

              {acceptedTenants.length >= dorm.room_capacity && (
                <Alert
                  message="Dorm is Full!"
                  description={`All ${dorm.room_capacity} beds are now occupied. No more spaces available.`}
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16, borderRadius: 12 }}
                  banner
                />
              )}

              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <div style={{ background: acceptedTenants.length >= dorm.room_capacity ? '#d4380d' : '#1e3a5f', color: '#fff', padding: '14px 20px', borderRadius: 12, fontWeight: 600, textAlign: 'center' }}>Occupied Beds: {acceptedTenants.length}</div>
                </Col>
                <Col xs={24} md={12}>
                  <div style={{ background: acceptedTenants.length >= dorm.room_capacity ? '#d4380d' : '#1e3a5f', color: '#fff', padding: '14px 20px', borderRadius: 12, fontWeight: 600, textAlign: 'center' }}>Unoccupied Beds: {dorm.room_capacity - acceptedTenants.length}</div>
                </Col>
              </Row>

              <Title level={5} style={{ marginBottom: 16, fontWeight: 700, marginTop: 24 }}>Upcoming Payments</Title>
              {acceptedTenants.length === 0 ? (
                <div style={{ background: '#f8fbff', padding: 32, borderRadius: 12, textAlign: 'center', border: '1px solid #e8f4fc' }}>
                  <Text type="secondary">No tenants yet.</Text>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {acceptedTenants.map((tenant) => {
                    // Calculate all payment dates for this tenant
                    const moveInDate = parseDate(tenant.move_in_date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Reset time for accurate day comparison
                    const contractEndDate = new Date(moveInDate);
                    contractEndDate.setMonth(contractEndDate.getMonth() + tenant.duration_months);
                    
                    const paymentSchedule: Array<{ date: Date; monthNumber: number }> = [];
                    let currentPaymentDate = new Date(moveInDate);
                    let monthCount = 1;
                    
                    // Generate all payment dates from move-in to contract end
                    while (currentPaymentDate <= contractEndDate) {
                      if (currentPaymentDate >= today) {
                        paymentSchedule.push({
                          date: new Date(currentPaymentDate),
                          monthNumber: monthCount,
                        });
                      }
                      currentPaymentDate.setMonth(currentPaymentDate.getMonth() + 1);
                      monthCount++;
                    }
                    
                    // Get next UNPAID payment info for the card header
                    const paymentsPaid = tenant.payments_paid || 0;
                    const nextUnpaidPayment = paymentSchedule.find(p => p.monthNumber > paymentsPaid);
                    const nextDueDate = nextUnpaidPayment?.date;
                    const daysUntilDue = nextDueDate ? Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                    const isDueSoon = daysUntilDue <= 7 && daysUntilDue >= 0;
                    const nextFormattedDate = nextDueDate ? nextDueDate.toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    }) : 'All Paid';
                    
                    return (
                      <Card 
                        key={tenant.id} 
                        style={{ 
                          borderRadius: 12, 
                          border: isDueSoon ? '2px solid #ff4d4f' : '1px solid #e8f4fc', 
                          background: isDueSoon ? '#fff1f0' : '#f8fbff',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          overflow: 'hidden',
                        }}
                      >
                        <Row gutter={16} align="middle" style={{ marginBottom: paymentSchedule.length > 0 ? 16 : 0 }}>
                          <Col flex="auto">
                            <Space direction="vertical" size={4} style={{ width: '100%' }}>
                              <Text strong style={{ fontSize: 15 }}>{tenant.full_name}</Text>
                              <Space size={8} style={{ flexWrap: 'wrap' }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  Move-in: {tenant.move_in_date}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>•</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {tenant.duration_months} month(s) contract
                                </Text>
                              </Space>
                              <Space size={8} style={{ marginTop: 4 }}>
                                <Tag color={isDueSoon ? 'red' : 'blue'} style={{ fontSize: 12, padding: '2px 10px' }}>
                                  Next Due: {nextFormattedDate}
                                </Tag>
                                {isDueSoon && (
                                  <Tag color="red" style={{ fontSize: 11, padding: '2px 8px' }}>
                                    {daysUntilDue} day{daysUntilDue !== 1 ? 's' : ''} left
                                  </Tag>
                                )}
                              </Space>
                            </Space>
                          </Col>
                          <Col>
                            <div style={{ textAlign: 'right' }}>
                              <Text strong style={{ fontSize: 18, display: 'block', marginBottom: 2, color: '#2979FF' }}>
                                ₱{Number(tenant.price_per_month).toLocaleString()}
                              </Text>
                              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>per month</Text>
                              <Button
                                danger
                                size="small"
                                style={{ display: 'block', marginLeft: 'auto' }}
                                loading={terminatingTenantId === tenant.id}
                                onClick={() => terminateTenant(tenant.id, tenant.full_name)}
                              >
                                Terminate Tenant
                              </Button>
                            </div>
                          </Col>
                        </Row>
                        
                        {paymentSchedule.length > 0 && (
                          <Collapse
                            ghost
                            size="small"
                            items={[
                              {
                                key: '1',
                                label: (
                                  <Text strong style={{ color: '#1e3a5f', fontSize: 13 }}>
                                    View All {paymentSchedule.length} Payment{paymentSchedule.length !== 1 ? 's' : ''}
                                  </Text>
                                ),
                                children: (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
                                    {paymentSchedule.map((payment, idx) => {
                                      const daysUntil = Math.ceil((payment.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                      const isDueSoon = daysUntil <= 7 && daysUntil >= 0;
                                      const formattedDate = payment.date.toLocaleDateString('en-US', { 
                                        year: 'numeric', 
                                        month: 'long', 
                                        day: 'numeric' 
                                      });
                                      
                                      const paymentsPaid = tenant.payments_paid || 0;
                                      const isPaid = payment.monthNumber <= paymentsPaid;
                                      const isNext = payment.monthNumber === paymentsPaid + 1;
                                      const isPending = payment.monthNumber > paymentsPaid + 1;
                                      
                                      return (
                                        <div 
                                          key={idx}
                                          style={{ 
                                            padding: '12px 16px', 
                                            background: isPaid ? '#f6ffed' : isDueSoon && isNext ? '#fff1f0' : '#ffffff',
                                            border: isPaid ? '1px solid #52c41a' : isDueSoon && isNext ? '1px solid #ff4d4f' : '1px solid #e8e8e8',
                                            borderRadius: 8,
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                          }}
                                        >
                                          <Space direction="vertical" size={2}>
                                            <Space size={8}>
                                              <Text strong style={{ fontSize: 13 }}>Payment #{payment.monthNumber}</Text>
                                              {isPaid && <Tag color="success" style={{ fontSize: 10, padding: '1px 6px' }}>PAID</Tag>}
                                              {isNext && <Tag color="processing" style={{ fontSize: 10, padding: '1px 6px' }}>NEXT</Tag>}
                                              {isPending && <Tag color="default" style={{ fontSize: 10, padding: '1px 6px' }}>PENDING</Tag>}
                                            </Space>
                                            <Text type="secondary" style={{ fontSize: 12 }}>{formattedDate}</Text>
                                            {isDueSoon && isNext && (
                                              <Tag color="red" style={{ fontSize: 10, padding: '1px 6px', marginTop: 4 }}>
                                                Due in {daysUntil} day{daysUntil !== 1 ? 's' : ''}
                                              </Tag>
                                            )}
                                          </Space>
                                          <Space>
                                            <Text strong style={{ fontSize: 15, color: isPaid ? '#52c41a' : isDueSoon && isNext ? '#ff4d4f' : '#2979FF' }}>
                                              ₱{Number(tenant.price_per_month).toLocaleString()}
                                            </Text>
                                            {isPaid && (
                                              <Button
                                                size="small"
                                                onClick={() => printPaymentReceipt(tenant, payment.monthNumber, payment.date)}
                                              >
                                                Print Receipt
                                              </Button>
                                            )}
                                            {isNext && !isPaid && (
                                              <Button 
                                                type="primary" 
                                                size="small"
                                                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                                                onClick={async () => {
                                                  try {
                                                    const token = localStorage.getItem(AUTH_TOKEN_KEY);
                                                    const res = await fetch(`${API_BASE}/reservations/${tenant.id}/mark-payment-paid`, {
                                                      method: 'PATCH',
                                                      headers: {
                                                        'Content-Type': 'application/json',
                                                        Authorization: `Bearer ${token}`,
                                                      },
                                                      body: JSON.stringify({ paymentNumber: payment.monthNumber }),
                                                    });
                                                    if (!res.ok) {
                                                      const err = await res.json();
                                                      throw new Error(err.message || 'Failed to mark as paid');
                                                    }
                                                    message.success(`Payment #${payment.monthNumber} marked as paid!`);
                                                    fetchNotifications();
                                                  } catch (err: any) {
                                                    message.error(err.message || 'Failed to mark payment as paid');
                                                  }
                                                }}
                                              >
                                                Mark as Paid
                                              </Button>
                                            )}
                                          </Space>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ),
                              },
                            ]}
                          />
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
              <div style={{ marginTop: 16 }}>
                <Text type="secondary"><strong>Contact:</strong> {dorm.email} · +63{dorm.phone} · {dorm.address} · ₱{dorm.price}/month</Text>
              </div>
            </div>
          </div>
        );

      case 'settings':
        return <Settings />;
      case 'messages':
        return <Messages />;
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
      <Sidebar collapsed={collapsed} onCollapse={setCollapsed} activeSection={activeSection} onSectionChange={setActiveSection} isMobile={isMobile} />

      {isMobile && !collapsed && (
        <div
          onClick={() => setCollapsed(true)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.25)',
            zIndex: 999,
          }}
        />
      )}

      <Layout style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Header style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: isMobile ? 'wrap' : 'nowrap', rowGap: 8, paddingInline: isMobile ? 12 : 24, paddingTop: isMobile ? 8 : 0, paddingBottom: isMobile ? 8 : 0, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)' }}>
          <Space size={16} style={{ display: 'flex', alignItems: 'center' }}>
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setCollapsed((prev) => !prev)}
                style={{ fontSize: 18 }}
              />
            )}
            <Title level={4} style={{ margin: 0 }}>{activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}</Title>
          </Space>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Dropdown
              open={notificationDropdownOpen}
              onOpenChange={setNotificationDropdownOpen}
              trigger={['click']}
              dropdownRender={() => (
                <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', width: isMobile ? '92vw' : 420, maxHeight: 500, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', fontWeight: 600, fontSize: 14 }}>
                    Notifications ({notificationCount})
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: 400 }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: 32, textAlign: 'center', color: '#999' }}>No new notifications</div>
                    ) : (
                      notifications.slice(0, 5).map((notif) => (
                        <div key={notif.id} style={{ padding: 12, borderBottom: '1px solid #f5f5f5', background: '#fafafa' }}>
                          <div style={{ marginBottom: 8 }}>
                            <Text strong style={{ fontSize: 13 }}>{notif.full_name}</Text>
                            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>wants to book</Text>
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <Text style={{ fontSize: 12, color: '#666' }}>
                              {notif.dorm_name} · {notif.move_in_date} · {notif.duration_months} month(s)
                            </Text>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <Button
                              size="small"
                              danger
                              icon={<CloseOutlined />}
                              loading={updatingId === notif.id}
                              onClick={() => updateStatus(notif.id, 'rejected')}
                            >
                              Reject
                            </Button>
                            <Button
                              size="small"
                              type="primary"
                              icon={<CheckOutlined />}
                              loading={updatingId === notif.id}
                              onClick={() => updateStatus(notif.id, 'approved')}
                            >
                              Confirm
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ padding: '10px 16px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
                    <Button
                      type="link"
                      block
                      onClick={() => {
                        setNotificationDropdownOpen(false);
                        setActiveSection('notifications');
                      }}
                    >
                      See All Notifications
                    </Button>
                  </div>
                </div>
              )}
            >
              <Badge count={notificationCount}>
                <BellOutlined style={{ fontSize: 20, cursor: 'pointer' }} />
              </Badge>
            </Dropdown>
            <Dropdown 
              trigger={["click"]} 
              menu={{ 
                items: [
                  { 
                    key: 'profile', 
                    label: 'Profile', 
                    icon: <UserOutlined />,
                    onClick: () => setActiveSection('profile')
                  },
                  { 
                    key: 'settings', 
                    label: 'Settings',
                    onClick: () => setActiveSection('settings')
                  },
                  { type: 'divider' },
                  { 
                    key: 'logout', 
                    label: 'Logout',
                    danger: true,
                    onClick: () => { if (onLogout) onLogout(); }
                  }
                ] 
              }}
            >
              <Avatar icon={<UserOutlined />} style={{ cursor: 'pointer' }} />
            </Dropdown>
          </div>
        </Header>

        <Content style={{ margin: isMobile ? 12 : 24, padding: isMobile ? 12 : 24, background: '#fff', borderRadius: 12, boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {renderSection()}
        </Content>

        <Modal title={null} open={setupModalOpen} onCancel={() => setSetupModalOpen(false)} footer={null} width={isMobile ? '95vw' : 640} closable={true} styles={{ body: { padding: 0 } }}>
          {setupModalContent}
        </Modal>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
