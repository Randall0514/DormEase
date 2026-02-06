import React, { useEffect, useState } from 'react';
import { Card, List, Switch, Typography, Row, Col, Space } from 'antd';
import {
  RightOutlined,
  InfoCircleOutlined,
  QuestionCircleOutlined,
  BgColorsOutlined,
  UnlockOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

const Settings: React.FC = () => {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem('darkMode');
    if (stored !== null) return stored === 'true';
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (darkMode) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  const settingsItems = [
    { label: 'Customize', icon: <BgColorsOutlined />, type: 'nav' },
    { label: 'Help', icon: <QuestionCircleOutlined />, type: 'nav' },
    { label: 'Dark Mode', icon: <BgColorsOutlined />, type: 'toggle' },
    { label: 'About Us', icon: <InfoCircleOutlined />, type: 'nav' },
    { label: 'Accessibility', icon: <UnlockOutlined />, type: 'toggle', value: false },
  ];

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', flex: 1, overflowY: 'auto', paddingRight: 12, paddingBottom: 48 }}>
        <Card title={<Title level={4} style={{ margin: 0 }}>Settings</Title>} style={{ borderRadius: 12, border: '1px solid #e6eefc' }} bodyStyle={{ paddingBottom: 24 }}>
          <List
            grid={{ gutter: 16, column: 2 }}
            dataSource={settingsItems}
            renderItem={(item) => (
              <List.Item>
                <Card hoverable style={{ width: '100%', borderRadius: 12, border: '1px solid #e9f1ff', transition: 'box-shadow 0.12s ease, border-color 0.12s ease' }}>
                  <Row align="middle" justify="space-between">
                    <Col>
                      <Space>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f0f5ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {item.icon}
                        </div>
                        <div>
                          <Text strong>{item.label}</Text>
                          {item.type === 'text' && <div><Text type="secondary">{item.value}</Text></div>}
                        </div>
                      </Space>
                    </Col>

                    <Col>
                      {item.type === 'toggle' ? (
                        item.label === 'Dark Mode' ? (
                          <Switch checked={darkMode} onChange={(v) => setDarkMode(v)} />
                        ) : (
                          <Switch defaultChecked={!!item.value} />
                        )
                      ) : (
                        <RightOutlined style={{ color: '#bfc9e6' }} />
                      )}
                    </Col>
                  </Row>
                </Card>
              </List.Item>
            )}
          />
        </Card>
      </div>
    </div>
  );
};

export default Settings;