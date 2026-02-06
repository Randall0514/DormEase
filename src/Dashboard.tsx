import React, { useState } from 'react';
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
} from 'antd';
import { BellOutlined, UserOutlined } from '@ant-design/icons';
import Sidebar, { type SectionKey } from './Sidebar';
import Profile from './Profile';
import Settings from './Settings';
import Notifications from './Notifications';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

interface DashboardProps {
  onLogout?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>('home');

  const renderSection = () => {
    switch (activeSection) {
      case 'home':
        return (
          <div>
            {/* Filters row */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} md={12}>
                <Card
                  bordered={false}
                  style={{
                    background: '#e0f0ff',
                    borderRadius: 16,
                  }}
                >
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    Price range
                  </Text>
                  <Tag
                    color="#ffffff"
                    style={{
                      borderRadius: 999,
                      padding: '6px 16px',
                      fontWeight: 500,
                      color: '#111827',
                    }}
                  >
                    2000–4000
                  </Tag>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card
                  bordered={false}
                  style={{
                    background: '#e0f0ff',
                    borderRadius: 16,
                  }}
                >
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    Maximum People
                  </Text>
                  <Space size={8} align="center">
                    <span role="img" aria-label="people">
                      👥
                    </span>
                    <Tag
                      color="#ffffff"
                      style={{
                        borderRadius: 999,
                        padding: '6px 16px',
                        fontWeight: 500,
                        color: '#111827',
                      }}
                    >
                      2–4
                    </Tag>
                  </Space>
                </Card>
              </Col>
            </Row>

            {/* Main content row */}
            <Row gutter={[24, 24]}>
              {/* Left: dorm cards */}
              <Col xs={24} lg={16}>
                <Title level={4} style={{ marginBottom: 16 }}>
                  Available dorms
                </Title>
                <Row gutter={[16, 16]}>
                  {/* Top row of three feature dorms */}
                  {[
                    { name: 'Malakasang dorm', price: '2500', featured: true },
                    { name: "Salvador's dorm", price: '6767', featured: true },
                    { name: "Drichs dorm", price: '8989', featured: true },
                  ].map((dorm) => (
                    <Col xs={24} md={8} key={dorm.name}>
                      <Card
                        hoverable
                        style={{
                          borderRadius: 16,
                          background: '#f5f9ff',
                          border: 'none',
                        }}
                        bodyStyle={{ padding: 12 }}
                      >
                        <div
                          style={{
                            background: '#d0e4ff',
                            borderRadius: 12,
                            height: 90,
                            marginBottom: 12,
                          }}
                        />
                        <Text strong>{dorm.name}</Text>
                        <br />
                        <Text type="secondary">{dorm.price}/month</Text>
                      </Card>
                    </Col>
                  ))}

                  {/* Second row of wider cards */}
                  {[
                    { name: 'Bedussy dorm', price: '4444' },
                    { name: "Randall's dorm", price: '6767' },
                    { name: 'Mayabang dorm', price: '5000' },
                    { name: 'Lebron dorm', price: '4000' },
                  ].map((dorm) => (
                    <Col xs={24} md={12} key={dorm.name}>
                      <Card
                        hoverable
                        style={{
                          borderRadius: 16,
                          background: '#f5f9ff',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        bodyStyle={{
                          padding: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            background: '#d0e4ff',
                            borderRadius: 10,
                            padding: '10px 16px',
                            fontWeight: 500,
                            minWidth: 70,
                            textAlign: 'center',
                          }}
                        >
                          Photo
                        </div>
                        <div style={{ flex: 1 }}>
                          <Text strong>{dorm.name}</Text>
                          <br />
                          <Text type="secondary">{dorm.price}/month</Text>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Col>

              {/* Right: owner profile panel */}
              <Col xs={24} lg={8}>
                <Card
                  style={{
                    borderRadius: 16,
                    background: '#f5f9ff',
                    border: 'none',
                  }}
                  bodyStyle={{ padding: 16 }}
                >
                  <Space align="center" style={{ marginBottom: 16 }}>
                    <Avatar size={48} />
                    <div>
                      <Text strong>Randall Salvador</Text>
                      <br />
                      <Text type="secondary">Dorm owner</Text>
                    </div>
                  </Space>

                  <Card
                    bordered={false}
                    style={{
                      background: '#e0f0ff',
                      borderRadius: 12,
                      marginBottom: 16,
                    }}
                  >
                    <Button
                      type="default"
                      block
                      style={{
                        borderRadius: 999,
                        fontWeight: 500,
                        background: '#ffffff',
                      }}
                    >
                      Photos
                    </Button>
                  </Card>

                  <Space size="small" style={{ marginBottom: 8 }}>
                    <Text strong>Overview</Text>
                    <Text type="secondary">Details</Text>
                    <Text type="secondary">Reviews</Text>
                  </Space>

                  <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                    Beckodusy beckodusy beckodusy beckodusy beckodusy beckodusy
                    beckodusy beckodusy beckodusy.
                  </Text>

                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    Location
                  </Text>
                  <div
                    style={{
                      background: '#d0e4ff',
                      borderRadius: 12,
                      height: 80,
                    }}
                  />
                </Card>
              </Col>
            </Row>
          </div>
        );
      case 'settings':
        return <Settings />;
      case 'notifications':
        return <Notifications />;
      case 'profile':
        return <Profile />;
      default:
        return null;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar
        collapsed={collapsed}
        onCollapse={setCollapsed}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <Layout style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Header
          style={{
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingInline: 24,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
        >
          <Space size={16} style={{ display: 'flex', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>
              {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
            </Title>
            <Input.Search
              placeholder="Search dorms, owners, or locations"
              allowClear
              style={{ minWidth: 220, maxWidth: 360 }}
              onSearch={(value) => {
                // Static for now – wire to real search later
                console.log('Search:', value);
              }}
            />
          </Space>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge count={3}>
              <BellOutlined style={{ fontSize: 20 }} />
            </Badge>
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  {
                    key: 'logout',
                    label: 'Logout',
                    onClick: () => {
                      if (onLogout) onLogout();
                    },
                  },
                ],
              }}
            >
              <Avatar
                icon={<UserOutlined />}
                style={{ cursor: 'pointer' }}
              />
            </Dropdown>
          </div>
        </Header>

        <Content
          style={{
            margin: 24,
            padding: 24,
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
            flex: 1,
            overflowY: 'auto',
          }}
        >
          {renderSection()}
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;

